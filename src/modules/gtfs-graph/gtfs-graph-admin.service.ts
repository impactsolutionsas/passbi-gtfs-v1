import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { GtfsGraphService } from './gtfs-graph.service';

@Injectable()
export class GtfsGraphAdminService {
	private readonly logger = new Logger(GtfsGraphAdminService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly graphService: GtfsGraphService,
	) {}

	async rebuildGraph() {
		this.logger.log('Rebuilding graph...');
		return this.graphService.buildGraph();
	}

	async getGraphStats() {
		const [nodesResult, edgesResult, agenciesResult] = await Promise.all([
			this.prisma.$queryRawUnsafe('SELECT COUNT(*)::bigint as count FROM node_route_stop') as Promise<Array<{ count: bigint }>>,
			this.prisma.$queryRawUnsafe('SELECT COUNT(*)::bigint as count FROM edges') as Promise<Array<{ count: bigint }>>,
			this.prisma.$queryRawUnsafe('SELECT COUNT(DISTINCT agency_id)::bigint as count FROM routes') as Promise<Array<{ count: bigint }>>,
		]);

		const nodes = Number(nodesResult[0]?.count || 0);
		const edges = Number(edgesResult[0]?.count || 0);
		const agencies = Number(agenciesResult[0]?.count || 0);

		// Get edges by mode
		const edgesByMode = await this.prisma.$queryRawUnsafe(`
			SELECT mode, COUNT(*)::bigint as count
			FROM edges
			GROUP BY mode
			ORDER BY mode
		`) as Array<{ mode: string; count: bigint }>;

		// Get routes count
		const routesCount = await this.prisma.$queryRawUnsafe(`
			SELECT COUNT(*)::bigint as count FROM routes
		`) as Array<{ count: bigint }>;

		// Get stops count
		const stopsCount = await this.prisma.$queryRawUnsafe(`
			SELECT COUNT(*)::bigint as count FROM stops
		`) as Array<{ count: bigint }>;

		return {
			nodes,
			edges,
			agencies,
			routes: Number(routesCount[0]?.count || 0),
			stops: Number(stopsCount[0]?.count || 0),
			edgesByMode: edgesByMode.map(e => ({
				mode: e.mode,
				count: Number(e.count),
			})),
		};
	}

	async validateGraph() {
		const issues: string[] = [];
		const warnings: string[] = [];

		// Check for isolated nodes (nodes with no edges)
		const isolatedNodes = await this.prisma.$queryRawUnsafe(`
			SELECT COUNT(*)::bigint as count
			FROM node_route_stop nrs
			WHERE NOT EXISTS (
				SELECT 1 FROM edges e WHERE e.from_node = nrs.id OR e.to_node = nrs.id
			)
		`) as Array<{ count: bigint }>;

		const isolatedCount = Number(isolatedNodes[0]?.count || 0);
		if (isolatedCount > 0) {
			warnings.push(`${isolatedCount} isolated nodes (no incoming or outgoing edges)`);
		}

		// Check for nodes with no outgoing edges
		const noOutgoing = await this.prisma.$queryRawUnsafe(`
			SELECT COUNT(*)::bigint as count
			FROM node_route_stop nrs
			WHERE NOT EXISTS (
				SELECT 1 FROM edges e WHERE e.from_node = nrs.id
			)
		`) as Array<{ count: bigint }>;

		const noOutgoingCount = Number(noOutgoing[0]?.count || 0);
		if (noOutgoingCount > 0) {
			warnings.push(`${noOutgoingCount} nodes with no outgoing edges`);
		}

		// Check for nodes with no incoming edges
		const noIncoming = await this.prisma.$queryRawUnsafe(`
			SELECT COUNT(*)::bigint as count
			FROM node_route_stop nrs
			WHERE NOT EXISTS (
				SELECT 1 FROM edges e WHERE e.to_node = nrs.id
			)
		`) as Array<{ count: bigint }>;

		const noIncomingCount = Number(noIncoming[0]?.count || 0);
		if (noIncomingCount > 0) {
			warnings.push(`${noIncomingCount} nodes with no incoming edges`);
		}

		// Check for disconnected components (simplified check)
		const componentCheck = await this.prisma.$queryRawUnsafe(`
			WITH RECURSIVE reachable AS (
				SELECT from_node as node FROM edges LIMIT 1
				UNION
				SELECT e.to_node
				FROM edges e
				INNER JOIN reachable r ON e.from_node = r.node
			)
			SELECT 
				(SELECT COUNT(*)::bigint FROM node_route_stop) as total_nodes,
				(SELECT COUNT(DISTINCT node)::bigint FROM reachable) as reachable_nodes
		`) as Array<{ total_nodes: bigint; reachable_nodes: bigint }>;

		const totalNodes = Number(componentCheck[0]?.total_nodes || 0);
		const reachableNodes = Number(componentCheck[0]?.reachable_nodes || 0);

		if (totalNodes > 0 && reachableNodes < totalNodes) {
			const disconnected = totalNodes - reachableNodes;
			warnings.push(`${disconnected} nodes are in disconnected components`);
		}

		// Check for edges with invalid node references
		const invalidEdges = await this.prisma.$queryRawUnsafe(`
			SELECT COUNT(*)::bigint as count
			FROM edges e
			WHERE NOT EXISTS (
				SELECT 1 FROM node_route_stop nrs WHERE nrs.id = e.from_node
			) OR NOT EXISTS (
				SELECT 1 FROM node_route_stop nrs WHERE nrs.id = e.to_node
			)
		`) as Array<{ count: bigint }>;

		const invalidEdgesCount = Number(invalidEdges[0]?.count || 0);
		if (invalidEdgesCount > 0) {
			issues.push(`${invalidEdgesCount} edges with invalid node references`);
		}

		// Check for empty graph
		const totalEdges = await this.prisma.$queryRawUnsafe(`
			SELECT COUNT(*)::bigint as count FROM edges
		`) as Array<{ count: bigint }>;

		if (Number(totalEdges[0]?.count || 0) === 0) {
			issues.push('Graph is empty (no edges)');
		}

		return {
			valid: issues.length === 0,
			issues,
			warnings,
		};
	}

	async getCacheStats() {
		// Check if route_cache table exists
		const cacheTableExists = await this.prisma.$queryRawUnsafe(`
			SELECT EXISTS (
				SELECT FROM information_schema.tables 
				WHERE table_schema = 'public' 
				AND table_name = 'route_cache'
			) as exists
		`) as Array<{ exists: boolean }>;

		if (!cacheTableExists[0]?.exists) {
			return {
				enabled: false,
				message: 'Route cache table does not exist',
			};
		}

		const [cacheStats, cacheSize] = await Promise.all([
			this.prisma.$queryRawUnsafe(`
				SELECT 
					COUNT(*)::bigint as total_entries,
					COUNT(CASE WHEN expires_at > NOW() THEN 1 END)::bigint as valid_entries,
					COUNT(CASE WHEN expires_at <= NOW() THEN 1 END)::bigint as expired_entries
				FROM route_cache
			`) as Promise<Array<{ total_entries: bigint; valid_entries: bigint; expired_entries: bigint }>>,
			this.prisma.$queryRawUnsafe(`
				SELECT pg_size_pretty(pg_total_relation_size('route_cache'))::text as size
			`) as Promise<Array<{ size: string }>>,
		]);

		return {
			enabled: true,
			totalEntries: Number(cacheStats[0]?.total_entries || 0),
			validEntries: Number(cacheStats[0]?.valid_entries || 0),
			expiredEntries: Number(cacheStats[0]?.expired_entries || 0),
			size: cacheSize[0]?.size || '0 bytes',
		};
	}

	async invalidateCache() {
		// Check if route_cache table exists
		const cacheTableExists = await this.prisma.$queryRawUnsafe(`
			SELECT EXISTS (
				SELECT FROM information_schema.tables 
				WHERE table_schema = 'public' 
				AND table_name = 'route_cache'
			) as exists
		`) as Array<{ exists: boolean }>;

		if (!cacheTableExists[0]?.exists) {
			return {
				message: 'Route cache table does not exist',
				deleted: 0,
			};
		}

		const result = await this.prisma.$queryRawUnsafe(`
			DELETE FROM route_cache
			RETURNING COUNT(*)::bigint as deleted
		`) as Array<{ deleted: bigint }>;

		const deleted = Number(result[0]?.deleted || 0);

		this.logger.log(`Cache invalidated: ${deleted} entries deleted`);

		return {
			message: 'Cache invalidated successfully',
			deleted,
		};
	}
}
