import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RouteQueryDto } from './dto/route-query.dto';
import { VtcService } from '../vtc/vtc.service';

interface GraphEdgeRow {
	from_node: number;
	to_node: number;
	mode: string;
	route_id: string | null;
	line_trip_id: string | null;
	dep_time_s: number | null;
	arr_time_s: number | null;
}

@Injectable()
export class RoutingService {
	private readonly logger = new Logger(RoutingService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly vtcService: VtcService
	) {}

	private async findNearestNodes(lat: number, lon: number, k = 5): Promise<number[]> {
		const rows = await this.prisma.$queryRawUnsafe(
			`select id from node_route_stop
			 order by geom <-> ST_SetSRID(ST_MakePoint($1, $2),4326)
			 limit $3`,
			lon, lat, k
		) as Array<{ id: bigint | number | string }>;
		return rows.map((r: { id: bigint | number | string }) => Number(r.id)).filter((n: number) => Number.isFinite(n));
	}

	private async bfsPathMulti(starts: number[], goals: Set<number>, maxVisited = 200000, maxDepth = 2000, maxNext = 200000): Promise<{ path: number[] | null, reached?: number }> {
		let frontier: number[] = Array.from(new Set(starts));
		const visited = new Set<number>(frontier);
		const parent = new Map<number, number>();
		let depth = 0;
		while (frontier.length > 0 && visited.size < maxVisited && depth < maxDepth) {
			for (const node of frontier) {
				if (goals.has(node)) {
					const path: number[] = [];
					let cur: number | undefined = node;
					while (cur !== undefined) {
						path.push(cur);
						cur = parent.get(cur);
					}
					path.reverse();
					return { path, reached: node };
				}
			}
			const rows = await this.prisma.$queryRawUnsafe(
				`select from_node, to_node from edges where from_node = ANY($1::bigint[])`,
				frontier
			) as Array<{ from_node: bigint | number | string; to_node: bigint | number | string }>;
			const next: number[] = [];
			for (const r of rows) {
				const from = Number(r.from_node);
				const to = Number(r.to_node);
				if (!visited.has(to)) {
					visited.add(to);
					if (!parent.has(to)) parent.set(to, from);
					next.push(to);
				}
			}
			frontier = Array.from(new Set(next)).slice(0, maxNext);
			depth++;
		}
		return { path: null };
	}

	private async edgesAlongPath(path: number[]): Promise<GraphEdgeRow[]> {
		if (path.length < 2) return [];
		const froms: number[] = [];
		const tos: number[] = [];
		for (let i = 0; i < path.length - 1; i++) {
			froms.push(path[i]!);
			tos.push(path[i + 1]!);
		}
		const rows = await this.prisma.$queryRawUnsafe(
			`select from_node, to_node, mode::text as mode, route_id, line_trip_id, dep_time_s, arr_time_s
			 from edges
			 where from_node = ANY($1::bigint[]) and to_node = ANY($2::bigint[])`,
			froms, tos
		) as GraphEdgeRow[];
		const edgeMap = new Map<string, GraphEdgeRow>();
		for (const r of rows) edgeMap.set(`${r.from_node}-${r.to_node}`, r as GraphEdgeRow);
		const ordered: GraphEdgeRow[] = [];
		for (let i = 0; i < froms.length; i++) {
			const key = `${froms[i]}-${tos[i]}`;
			const e = edgeMap.get(key);
			if (e) ordered.push(e);
		}
		return ordered;
	}

	/**
	 * Merge legs with the same route_id, even when separated by walk segments
	 * This ensures each unique route_id appears only once per journey
	 * Walk segments between merged route segments are removed
	 */
	private mergeDuplicateRouteIds(legs: any[]): any[] {
		if (legs.length === 0) return legs;

		const merged: any[] = [];
		const processed = new Set<number>();
		const walksToSkip = new Set<number>();

		// First pass: identify walk segments that are between legs with the same route_id
		for (let i = 0; i < legs.length; i++) {
			const leg = legs[i]!;
			const isWalk = !leg.route_id || leg.mode === 'walk';
			
			if (isWalk) {
				// Check if this walk is between two legs with the same route_id
				const prevLeg = i > 0 ? legs[i - 1] : null;
				const nextLeg = i < legs.length - 1 ? legs[i + 1] : null;
				
				if (prevLeg && nextLeg && 
					prevLeg.route_id && nextLeg.route_id &&
					prevLeg.mode !== 'walk' && nextLeg.mode !== 'walk' &&
					prevLeg.route_id === nextLeg.route_id) {
					// This walk is between two legs with the same route_id, mark it to skip
					walksToSkip.add(i);
				}
			}
		}

		// Second pass: merge legs with the same route_id and build result
		for (let i = 0; i < legs.length; i++) {
			if (processed.has(i)) continue;

			const currentLeg = legs[i]!;

			// Skip walk segments that are between merged route segments
			if (walksToSkip.has(i)) {
				processed.add(i);
				continue;
			}

			// If it's a walk segment, keep it as is
			if (!currentLeg.route_id || currentLeg.mode === 'walk') {
				merged.push(currentLeg);
				processed.add(i);
				continue;
			}

			// Find all subsequent legs with the same route_id (separated only by walk segments)
			const routeId = currentLeg.route_id;
			const legsToMerge: number[] = [i];
			let j = i + 1;

			// Look ahead for legs with the same route_id, skipping walk segments
			while (j < legs.length) {
				const nextLeg = legs[j]!;
				
				// If we encounter a walk segment, skip it and continue
				if (!nextLeg.route_id || nextLeg.mode === 'walk') {
					j++;
					continue;
				}

				// If we encounter a different route_id, stop looking
				if (nextLeg.route_id !== routeId) {
					break;
				}

				// Found another leg with the same route_id
				legsToMerge.push(j);
				j++;
			}

			// Merge all legs with the same route_id
			if (legsToMerge.length === 1) {
				// Only one leg with this route_id, keep it as is
				merged.push(currentLeg);
			} else {
				// Multiple legs to merge
				const firstLeg = legs[legsToMerge[0]!]!;
				const lastLeg = legs[legsToMerge[legsToMerge.length - 1]!]!;

				// Create merged leg with first leg's from_stop and last leg's to_stop
				const mergedLeg = {
					...firstLeg,
					to_stop: lastLeg.to_stop,
				};

				merged.push(mergedLeg);
			}

			// Mark all merged legs as processed
			for (const idx of legsToMerge) {
				processed.add(idx);
			}
		}

		return merged;
	}

	private async enrichLegs(edges: GraphEdgeRow[]): Promise<{ legs: any[]; stepCount: number }> {
		if (edges.length === 0) return { legs: [], stepCount: 0 };
		
		// Construire les paires from_node, to_node pour récupérer les edge_ids
		const fromNodes: number[] = [];
		const toNodes: number[] = [];
		for (const edge of edges) {
			fromNodes.push(edge.from_node);
			toNodes.push(edge.to_node);
		}

		// Récupérer les edge_ids avec ordre préservé
		const edgeRows = await this.prisma.$queryRawUnsafe(`
			select e.id, e.from_node, e.to_node
			from edges e
			where (e.from_node, e.to_node) in (
				select unnest($1::bigint[]), unnest($2::bigint[])
			)
		`, fromNodes, toNodes) as Array<{ id: bigint | number | string; from_node: bigint | number | string; to_node: bigint | number | string }>;

		// Créer un map pour retrouver l'ordre
		const edgeMap = new Map<string, number>();
		for (const row of edgeRows) {
			edgeMap.set(`${row.from_node}-${row.to_node}`, Number(row.id));
		}

		// Reconstituer l'ordre des edge_ids
		const edgeIds: number[] = [];
		for (let i = 0; i < edges.length; i++) {
			const key = `${edges[i]!.from_node}-${edges[i]!.to_node}`;
			const edgeId = edgeMap.get(key);
			if (edgeId) edgeIds.push(edgeId);
		}

		if (edgeIds.length === 0) return { legs: [], stepCount: 0 };

		// Requête unique enrichie avec ordre préservé
		const rows = await this.prisma.$queryRawUnsafe(`
			with seq as (
				select unnest($1::bigint[]) as edge_id, generate_series(1, array_length($1::bigint[],1)) as ord
			)
			select
				seq.ord,
				e.id as edge_id,
				e.mode,
				e.route_id,
				e.line_trip_id,
				r.route_short_name,
				r.route_long_name,
				r.agency_id,
				n1.id  as from_node_id,
				s1.stop_id as from_stop_id,
				s1.stop_name as from_stop_name,
				s1.stop_lat,
				s1.stop_lon,
				n2.id  as to_node_id,
				s2.stop_id as to_stop_id,
				s2.stop_name as to_stop_name,
				s2.stop_lat as to_stop_lat,
				s2.stop_lon as to_stop_lon
			from seq
			join edges e           on e.id = seq.edge_id
			join node_route_stop n1 on n1.id = e.from_node
			join node_route_stop n2 on n2.id = e.to_node
			join stops s1           on s1.stop_id = n1.stop_id
			join stops s2           on s2.stop_id = n2.stop_id
			left join routes r      on r.route_id = e.route_id
			order by seq.ord
		`, edgeIds) as Array<any>;

		// Agréger en legs par (mode, route_id) et compter les étapes
		const legs: any[] = [];
		let current: any = null;
		let stepCount = 0;

		for (const e of rows) {
			const sameBucket = current
				&& current.mode === e.mode
				&& (current.route_id || null) === (e.route_id || null);

			if (!sameBucket) {
				if (current) {
					legs.push(current);
					stepCount++;
				}
				current = {
					mode: e.mode,
					agency_id: e.agency_id ?? null,
					route_id: e.route_id ?? null,
					route_short_name: e.route_short_name ?? null,
					route_long_name: e.route_long_name ?? null,
					from_stop: {
						stop_id: e.from_stop_id,
						stop_name: e.from_stop_name,
						stop_lat: e.stop_lat,
						stop_lon: e.stop_lon,
					},
					to_stop: {
						stop_id: e.to_stop_id,
						stop_name: e.to_stop_name,
						stop_lat: e.to_stop_lat,
						stop_lon: e.to_stop_lon,
					}
				};
			} else {
				// Étendre le leg courant (même route_id)
				current.to_stop = {
					stop_id: e.to_stop_id,
					stop_name: e.to_stop_name,
					stop_lat: e.to_stop_lat,
					stop_lon: e.to_stop_lon,
				};
			}
		}
		if (current) {
			legs.push(current);
			stepCount++;
		}

		// Merge duplicate route_ids (even when separated by walk segments)
		const mergedLegs = this.mergeDuplicateRouteIds(legs);
		
		// Recalculate stepCount based on merged legs
		const finalStepCount = mergedLegs.length;

		return { legs: mergedLegs, stepCount: finalStepCount };
	}

	async route(dto: RouteQueryDto) {
		const startCandidates = await this.findNearestNodes(dto.fromLat, dto.fromLon, 5);
		const goalCandidates = await this.findNearestNodes(dto.toLat, dto.toLon, 5);
		if (startCandidates.length === 0 || goalCandidates.length === 0) return { error: 'No path found' };
		const goalsSet = new Set<number>(goalCandidates);
		const { path } = await this.bfsPathMulti(startCandidates, goalsSet);
		if (!path) return { error: 'No path found' };
		const edges = await this.edgesAlongPath(path);
		const { legs: itinerary, stepCount } = await this.enrichLegs(edges);

		// Ajouter les alternatives VTC
		const vtcAlternatives = await this.vtcService.computeFare(
			dto.fromLat, 
			dto.fromLon, 
			dto.toLat, 
			dto.toLon
		);

		// Ajouter le trajet direct dans la réponse
		const directResult = await this.routeDirect(dto);

		return {
			from: { lat: dto.fromLat, lon: dto.fromLon },
			to: { lat: dto.toLat, lon: dto.toLon },
			itinerary,
			stepCount,
			//direct: directResult,
			alternatives: vtcAlternatives
		};
	}

	/**
	 * Recherche un trajet direct avec un seul mode de transport
	 */
	async routeDirect(dto: RouteQueryDto) {
		const startCandidates = await this.findNearestNodes(dto.fromLat, dto.fromLon, 5);
		const goalCandidates = await this.findNearestNodes(dto.toLat, dto.toLon, 5);
		if (startCandidates.length === 0 || goalCandidates.length === 0) return { error: 'No path found' };

		// Rechercher un trajet direct (un seul mode) entre les nœuds les plus proches
		const directPath = await this.findDirectPath(startCandidates, goalCandidates);
		if (!directPath) return { error: 'No direct path found' };

		const edges = await this.edgesAlongPath(directPath);
		const { legs: itinerary, stepCount } = await this.enrichLegs(edges);

		// Ajouter les alternatives VTC
		const vtcAlternatives = await this.vtcService.computeFare(
			dto.fromLat, 
			dto.fromLon, 
			dto.toLat, 
			dto.toLon
		);

		return {
			from: { lat: dto.fromLat, lon: dto.fromLon },
			to: { lat: dto.toLat, lon: dto.toLon },
			itinerary,
			stepCount,
			alternatives: vtcAlternatives
		};
	}

	/**
	 * Trouve un chemin direct entre les nœuds de départ et d'arrivée
	 */
	private async findDirectPath(starts: number[], goals: number[]): Promise<number[] | null> {
		// Rechercher une connexion directe entre les nœuds les plus proches
		for (const start of starts) {
			for (const goal of goals) {
				// Vérifier s'il existe un edge direct
				const directEdge = await this.prisma.$queryRawUnsafe(
					`SELECT from_node, to_node FROM edges WHERE from_node = $1 AND to_node = $2 LIMIT 1`,
					start, goal
				) as Array<{ from_node: bigint | number | string; to_node: bigint | number | string }>;
				
				if (directEdge.length > 0) {
					return [start, goal];
				}
			}
		}

		// Si pas de connexion directe, utiliser BFS mais avec une profondeur limitée
		const goalsSet = new Set<number>(goals);
		const { path } = await this.bfsPathMulti(starts, goalsSet, 10000, 5, 10000);
		return path;
	}
}
