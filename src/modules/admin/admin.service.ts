import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class AdminService {
	private readonly logger = new Logger(AdminService.name);

	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Danger: Wipes GTFS and derived data.
	 * - Drops materialized views
	 * - Truncates derived (edges, node_route_stop) and core GTFS tables
	 * - Restarts identities and cascades to dependent tables
	 */
	async resetDatabase(): Promise<{ status: string }> {
		this.logger.warn('Resetting database: dropping MV and truncating GTFS tables...');
		// Drop MV if exists
		await this.prisma.$executeRawUnsafe('DROP MATERIALIZED VIEW IF EXISTS mv_next_departures');

		// Truncate derived + core tables in one go; restart identity counters
		await this.prisma.$executeRawUnsafe(
			`TRUNCATE TABLE 
			  edges,
			  node_route_stop,
			  vtc_config,
			  calendar_dates,
			  calendar,
			  stop_times,
			  trips,
			  routes,
			  stops,
			  fare_rules,
			  fare_attributes,
			  shapes,
			  agency
			RESTART IDENTITY CASCADE`
		);

		this.logger.warn('Database reset completed.');
		return { status: 'ok' };
	}
}
