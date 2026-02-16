import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RouteQueryDto } from './dto/route-query.dto';
import { RoutingCacheService } from './routing-cache.service';
import { RoutingScoringService } from './routing-scoring.service';
import { RoutingLearningService } from './routing-learning.service';
import { RouteResponse, RouteVariant } from './dto/route-response.dto';

interface GraphEdgeRow {
	from_node: number;
	to_node: number;
	mode: string;
	route_id: string | null;
	line_trip_id: string | null;
	dep_time_s: number | null;
	arr_time_s: number | null;
}

interface BfsResult {
	path: number[] | null;
	reached?: number;
	nodesVisited?: number;
}

@Injectable()
export class RoutingService {
	private readonly logger = new Logger(RoutingService.name);
	private readonly WALK_ONLY_THRESHOLD_M = 500;
	private readonly WALK_SPEED_MPS = 1.25;

	constructor(
		private readonly prisma: PrismaService,
		private readonly cacheService: RoutingCacheService,
		private readonly scoringService: RoutingScoringService,
		private readonly learningService: RoutingLearningService,
	) {}

	private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
		const R = 6371000;
		const dLat = ((lat2 - lat1) * Math.PI) / 180;
		const dLon = ((lon2 - lon1) * Math.PI) / 180;
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos((lat1 * Math.PI) / 180) *
				Math.cos((lat2 * Math.PI) / 180) *
				Math.sin(dLon / 2) *
				Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return R * c;
	}

	private async findNearestNodes(lat: number, lon: number, k = 5): Promise<number[]> {
		const rows = await this.prisma.$queryRawUnsafe(
			`select id from node_route_stop
			 order by geom <-> ST_SetSRID(ST_MakePoint($1, $2),4326)
			 limit $3`,
			lon, lat, k
		) as Array<{ id: bigint | number | string }>;
		return rows.map((r: { id: bigint | number | string }) => Number(r.id)).filter((n: number) => Number.isFinite(n));
	}

	private async bfsRecursiveCTE(starts: number[], goals: Set<number>, maxDepth = 8): Promise<BfsResult> {
		if (starts.length === 0 || goals.size === 0) {
			return { path: null };
		}

		const goalsArr = Array.from(goals);

		const rows = await this.prisma.$queryRawUnsafe(`
			WITH RECURSIVE bfs AS (
				SELECT 
					id as node_id, 
					0 as depth, 
					CAST(NULL AS bigint) as parent,
					ARRAY[id] as path
				FROM unnest($1::bigint[]) as t(id)
				
				UNION ALL
				
				SELECT 
					e.to_node,
					b.depth + 1,
					e.from_node,
					b.path || e.to_node
				FROM bfs b
				JOIN edges e ON e.from_node = b.node_id
				WHERE b.depth < $3
					AND NOT (e.to_node = ANY(b.path))
			)
			SELECT node_id, depth, parent, path
			FROM bfs
			WHERE node_id = ANY($2::bigint[])
			ORDER BY depth ASC
			LIMIT 1
		`, starts, goalsArr, maxDepth) as Array<{ node_id: bigint; depth: number; parent: bigint | null; path: bigint[] }>;

		if (rows.length === 0) {
			return { path: null };
		}

		const row = rows[0]!;
		const path = row.path.map(n => Number(n));
		return { path, reached: Number(row.node_id) };
	}

	private async bfsPathMulti(starts: number[], goals: Set<number>, maxVisited = 100000, maxDepth = 8): Promise<BfsResult> {
		let frontier: number[] = Array.from(new Set(starts));
		const visited = new Set<number>(frontier);
		const parent = new Map<number, number>();
		let depth = 0;

		for (const node of frontier) {
			if (goals.has(node)) {
				return { path: [node], reached: node, nodesVisited: 1 };
			}
		}

		while (frontier.length > 0 && visited.size < maxVisited && depth < maxDepth) {
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

					if (goals.has(to)) {
						const path: number[] = [];
						let cur: number | undefined = to;
						while (cur !== undefined) {
							path.push(cur);
							cur = parent.get(cur);
						}
						path.reverse();
						return { path, reached: to, nodesVisited: visited.size };
					}

					next.push(to);
				}
			}
			frontier = Array.from(new Set(next));
			depth++;
		}
		return { path: null, nodesVisited: visited.size };
	}

	private async findDirectRoutePathOptimized(starts: number[], goals: Set<number>): Promise<{ route_id: string | null; path: number[] } | null> {
		if (!starts?.length || !goals || goals.size === 0) return null;

		const startsArr = starts;
		const goalsArr = Array.from(goals);

		const candidates = await this.prisma.$queryRawUnsafe(
			`WITH r_start AS (
			   SELECT DISTINCT route_id FROM edges WHERE from_node = ANY($1::bigint[]) OR to_node = ANY($1::bigint[])
			), r_goal AS (
			   SELECT DISTINCT route_id FROM edges WHERE from_node = ANY($2::bigint[]) OR to_node = ANY($2::bigint[])
			)
			SELECT rs.route_id
			FROM r_start rs
			INNER JOIN r_goal rg ON rs.route_id = rg.route_id
			WHERE rs.route_id IS NOT NULL
			LIMIT 50
			`,
			startsArr,
			goalsArr
		) as Array<{ route_id: string | null }>;

		for (const c of candidates) {
			const routeId = c.route_id ?? null;
			if (routeId) {
				const path = await this.bfsConstrainedByRoute(startsArr, goals, routeId);
				if (path && path.length > 0) return { route_id: routeId, path };
			}
		}

		return null;
	}

	private async bfsConstrainedByRoute(starts: number[], goals: Set<number>, routeId: string): Promise<number[] | null> {
		const rows = await this.prisma.$queryRawUnsafe(
			`SELECT from_node, to_node FROM edges WHERE route_id = $1`,
			routeId
		) as Array<{ from_node: bigint | number | string; to_node: bigint | number | string }>;

		const adj = new Map<number, number[]>();
		for (const r of rows) {
			const from = Number(r.from_node);
			const to = Number(r.to_node);
			if (!adj.has(from)) adj.set(from, []);
			adj.get(from)!.push(to);
		}

		const q: number[] = Array.from(new Set(starts));
		const parent = new Map<number, number | undefined>();
		const visited = new Set<number>(q);

		for (const node of q) {
			if (goals.has(node)) {
				return [node];
			}
		}

		while (q.length > 0) {
			const node = q.shift()!;
			const neigh = adj.get(node) || [];
			for (const n of neigh) {
				if (visited.has(n)) continue;
				visited.add(n);
				parent.set(n, node);

				if (goals.has(n)) {
					const path: number[] = [];
					let cur: number | undefined = n;
					while (cur !== undefined) {
						path.push(cur);
						cur = parent.get(cur) as number | undefined;
					}
					path.reverse();
					return path;
				}

				q.push(n);
			}
		}

		return null;
	}

	private async bfsWithTransferLimit(starts: number[], goals: number[], maxTransfers = 1): Promise<number[] | null> {
		const rows = await this.prisma.$queryRawUnsafe(
			`SELECT from_node, to_node, route_id FROM edges 
			 WHERE from_node = ANY($1::bigint[]) OR to_node = ANY($2::bigint[])
			 UNION
			 SELECT e.from_node, e.to_node, e.route_id FROM edges e
			 WHERE EXISTS (
				SELECT 1 FROM edges e2 
				WHERE e2.from_node = ANY($1::bigint[]) AND e.from_node = e2.to_node
			 )`,
			starts, goals
		) as Array<{ from_node: bigint | number | string; to_node: bigint | number | string; route_id: string | null }>;

		const adj = new Map<number, Array<{ to: number; route_id: string | null }>>();
		for (const r of rows) {
			const from = Number(r.from_node);
			const to = Number(r.to_node);
			if (!adj.has(from)) adj.set(from, []);
			adj.get(from)!.push({ to, route_id: r.route_id ?? null });
		}

		type State = { node: number; transfers: number; currentRoute: string | null; parent?: State | null };
		const queue: State[] = [];
		const seen = new Map<string, number>();
		const goalsSet = new Set(goals);

		for (const s of starts) {
			if (goalsSet.has(s)) {
				return [s];
			}
			queue.push({ node: s, transfers: 0, currentRoute: null, parent: null });
		}

		while (queue.length > 0) {
			const cur = queue.shift()!;

			const key = `${cur.node}|${cur.currentRoute ?? 'null'}`;
			if (seen.has(key) && seen.get(key)! <= cur.transfers) continue;
			seen.set(key, cur.transfers);

			const neighbours = adj.get(cur.node) || [];
			for (const n of neighbours) {
				const nextTransfers = cur.currentRoute && cur.currentRoute !== n.route_id ? cur.transfers + 1 : cur.transfers;
				if (nextTransfers > maxTransfers) continue;

				if (goalsSet.has(n.to)) {
					const rev: number[] = [n.to];
					let p: State | undefined | null = cur;
					while (p) {
						rev.push(p.node);
						p = p.parent || undefined;
					}
					rev.reverse();
					return rev;
				}

				queue.push({ node: n.to, transfers: nextTransfers, currentRoute: n.route_id, parent: cur });
			}
		}

		return null;
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

	private mergeDuplicateRouteIds(legs: any[]): any[] {
		if (legs.length === 0) return legs;

		const merged: any[] = [];
		const processed = new Set<number>();
		const walksToSkip = new Set<number>();

		for (let i = 0; i < legs.length; i++) {
			const leg = legs[i]!;
			const isWalk = !leg.route_id || leg.mode === 'walk';
			
			if (isWalk) {
				const prevLeg = i > 0 ? legs[i - 1] : null;
				const nextLeg = i < legs.length - 1 ? legs[i + 1] : null;
				
				if (prevLeg && nextLeg && 
					prevLeg.route_id && nextLeg.route_id &&
					prevLeg.mode !== 'walk' && nextLeg.mode !== 'walk' &&
					prevLeg.route_id === nextLeg.route_id) {
					walksToSkip.add(i);
				}
			}
		}

		for (let i = 0; i < legs.length; i++) {
			if (processed.has(i)) continue;

			const currentLeg = legs[i]!;

			if (walksToSkip.has(i)) {
				processed.add(i);
				continue;
			}

			if (!currentLeg.route_id || currentLeg.mode === 'walk') {
				merged.push(currentLeg);
				processed.add(i);
				continue;
			}

			const routeId = currentLeg.route_id;
			const legsToMerge: number[] = [i];
			let j = i + 1;

			while (j < legs.length) {
				const nextLeg = legs[j]!;
				
				if (!nextLeg.route_id || nextLeg.mode === 'walk') {
					j++;
					continue;
				}

				if (nextLeg.route_id !== routeId) {
					break;
				}

				legsToMerge.push(j);
				j++;
			}

			if (legsToMerge.length === 1) {
				merged.push(currentLeg);
			} else {
				const firstLeg = legs[legsToMerge[0]!]!;
				const lastLeg = legs[legsToMerge[legsToMerge.length - 1]!]!;

				const mergedLeg = {
					...firstLeg,
					to_stop: lastLeg.to_stop,
				};

				merged.push(mergedLeg);
			}

			for (const idx of legsToMerge) {
				processed.add(idx);
			}
		}

		return merged;
	}

	private async enrichLegs(edges: GraphEdgeRow[]): Promise<{ legs: any[]; stepCount: number }> {
		if (edges.length === 0) return { legs: [], stepCount: 0 };
		
		const fromNodes: number[] = [];
		const toNodes: number[] = [];
		for (const edge of edges) {
			fromNodes.push(edge.from_node);
			toNodes.push(edge.to_node);
		}

		const edgeRows = await this.prisma.$queryRawUnsafe(`
			select e.id, e.from_node, e.to_node
			from edges e
			where (e.from_node, e.to_node) in (
				select unnest($1::bigint[]), unnest($2::bigint[])
			)
		`, fromNodes, toNodes) as Array<{ id: bigint | number | string; from_node: bigint | number | string; to_node: bigint | number | string }>;

		const edgeMap = new Map<string, number>();
		for (const row of edgeRows) {
			edgeMap.set(`${row.from_node}-${row.to_node}`, Number(row.id));
		}

		const edgeIds: number[] = [];
		for (let i = 0; i < edges.length; i++) {
			const key = `${edges[i]!.from_node}-${edges[i]!.to_node}`;
			const edgeId = edgeMap.get(key);
			if (edgeId) edgeIds.push(edgeId);
		}

		if (edgeIds.length === 0) return { legs: [], stepCount: 0 };

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

		const legs: any[] = [];
		let current: any = null;

		for (const e of rows) {
			const sameBucket = current
				&& current.mode === e.mode
				&& (current.route_id || null) === (e.route_id || null);

			if (!sameBucket) {
				if (current) {
					legs.push(current);
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
		}

		const mergedLegs = this.mergeDuplicateRouteIds(legs);
		const finalStepCount = mergedLegs.length;

		return { legs: mergedLegs, stepCount: finalStepCount };
	}

	private async tryAcquireLock(cacheKey: string, ttlMs: number): Promise<boolean> {
		const expiresAt = new Date(Date.now() + ttlMs);
		try {
			await this.prisma.$executeRawUnsafe(
				`INSERT INTO route_locks (cache_key, expires_at)
				 VALUES ($1, $2)
				 ON CONFLICT (cache_key) DO NOTHING`,
				cacheKey,
				expiresAt
			);
			const result = await this.prisma.$queryRawUnsafe(
				`SELECT 1 FROM route_locks WHERE cache_key = $1 AND expires_at = $2`,
				cacheKey,
				expiresAt
			) as Array<{ '?column?': number }>;
			return result.length > 0;
		} catch {
			return false;
		}
	}

	private async releaseLock(cacheKey: string): Promise<void> {
		try {
			await this.prisma.$executeRawUnsafe(
				`DELETE FROM route_locks WHERE cache_key = $1`,
				cacheKey
			);
		} catch {
		}
	}

	private async waitForCache(cacheKey: string, maxWaitMs = 5000, intervalMs = 100): Promise<any | null> {
		const startTime = Date.now();
		while (Date.now() - startTime < maxWaitMs) {
			const cached = await this.cacheService.get(cacheKey);
			if (cached) return cached;
			await new Promise(resolve => setTimeout(resolve, intervalMs));
		}
		return null;
	}

	async route(dto: RouteQueryDto) {
		const straightDistance = this.haversineDistance(dto.fromLat, dto.fromLon, dto.toLat, dto.toLon);
		if (straightDistance <= this.WALK_ONLY_THRESHOLD_M) {
			const durationMin = Math.round((straightDistance / this.WALK_SPEED_MPS) / 60);
			return {
				from: { lat: dto.fromLat, lon: dto.fromLon },
				to: { lat: dto.toLat, lon: dto.toLon },
				walkOnly: true,
				distance_m: Math.round(straightDistance),
				duration_min: durationMin,
				message: 'Distance is short enough to walk directly',
				itinerary: [{
					mode: 'walk',
					distance_m: Math.round(straightDistance),
					duration_min: durationMin,
				}],
				stepCount: 1,
				direct: null,
				alternatives: []
			};
		}

		const cacheKey = this.cacheService.generateCacheKey(dto.fromLat, dto.fromLon, dto.toLat, dto.toLon);
		
		const cached = await this.cacheService.get(cacheKey);
		if (cached) {
			this.logger.debug(`Cache hit for route`);
			return cached;
		}

		const lockAcquired = await this.tryAcquireLock(cacheKey, 30000);
		if (!lockAcquired) {
			this.logger.debug(`Lock not acquired, waiting for cache`);
			const waitedResult = await this.waitForCache(cacheKey, 5000);
			if (waitedResult) return waitedResult;
		}

		try {
			const cachedAfterLock = await this.cacheService.get(cacheKey);
			if (cachedAfterLock) {
				return cachedAfterLock;
			}

			const startCandidates = await this.findNearestNodes(dto.fromLat, dto.fromLon, 5);
			const goalCandidates = await this.findNearestNodes(dto.toLat, dto.toLon, 5);
			
			if (startCandidates.length === 0 || goalCandidates.length === 0) {
				return { error: 'No nearby stops found' };
			}

			const goalsSet = new Set<number>(goalCandidates);

			const directResult = await this.findDirectRoutePathOptimized(startCandidates, goalsSet);
			let directItinerary = null;
			let directStepCount = 0;

			if (directResult && directResult.path) {
				const directEdges = await this.edgesAlongPath(directResult.path);
				const { legs, stepCount } = await this.enrichLegs(directEdges);
				directItinerary = legs;
				directStepCount = stepCount;
			}

			const { path } = await this.bfsPathMulti(startCandidates, goalsSet);
			
			if (!path) {
				if (directItinerary) {
					const result = {
						from: { lat: dto.fromLat, lon: dto.fromLon },
						to: { lat: dto.toLat, lon: dto.toLon },
						itinerary: directItinerary,
						stepCount: directStepCount,
						direct: {
							itinerary: directItinerary,
							stepCount: directStepCount
						},
						alternatives: []
					};
					await this.cacheService.set(cacheKey, result);
					return result;
				}
				return { error: 'No path found' };
			}

			const edges = await this.edgesAlongPath(path);
			const { legs: itinerary, stepCount } = await this.enrichLegs(edges);

			const result = {
				from: { lat: dto.fromLat, lon: dto.fromLon },
				to: { lat: dto.toLat, lon: dto.toLon },
				itinerary,
				stepCount,
				direct: directItinerary ? {
					from: { lat: dto.fromLat, lon: dto.fromLon },
					to: { lat: dto.toLat, lon: dto.toLon },
					itinerary: directItinerary,
					stepCount: directStepCount,
					alternatives: []
				} : null,
				alternatives: []
			};

			await this.cacheService.set(cacheKey, result);

			return result;
		} finally {
			if (lockAcquired) {
				await this.releaseLock(cacheKey);
			}
		}
	}

	async routeDirect(dto: RouteQueryDto) {
		const straightDistance = this.haversineDistance(dto.fromLat, dto.fromLon, dto.toLat, dto.toLon);
		if (straightDistance <= this.WALK_ONLY_THRESHOLD_M) {
			const durationMin = Math.round((straightDistance / this.WALK_SPEED_MPS) / 60);
			return {
				from: { lat: dto.fromLat, lon: dto.fromLon },
				to: { lat: dto.toLat, lon: dto.toLon },
				walkOnly: true,
				distance_m: Math.round(straightDistance),
				duration_min: durationMin,
				itinerary: [{
					mode: 'walk',
					distance_m: Math.round(straightDistance),
					duration_min: durationMin,
				}],
				stepCount: 1,
				alternatives: []
			};
		}

		const cacheKey = `direct:${this.cacheService.generateCacheKey(dto.fromLat, dto.fromLon, dto.toLat, dto.toLon)}`;
		
		const cached = await this.cacheService.get(cacheKey);
		if (cached) {
			return cached;
		}

		const startCandidates = await this.findNearestNodes(dto.fromLat, dto.fromLon, 5);
		const goalCandidates = await this.findNearestNodes(dto.toLat, dto.toLon, 5);
		
		if (startCandidates.length === 0 || goalCandidates.length === 0) {
			return { error: 'No nearby stops found' };
		}

		const goalsSet = new Set<number>(goalCandidates);
		const directResult = await this.findDirectRoutePathOptimized(startCandidates, goalsSet);
		
		if (!directResult || !directResult.path) {
			return { error: 'No direct path found' };
		}

		const edges = await this.edgesAlongPath(directResult.path);
		const { legs: itinerary, stepCount } = await this.enrichLegs(edges);

		const result = {
			from: { lat: dto.fromLat, lon: dto.fromLon },
			to: { lat: dto.toLat, lon: dto.toLon },
			itinerary,
			stepCount,
			alternatives: []
		};

		await this.cacheService.set(cacheKey, result);

		return result;
	}
}
