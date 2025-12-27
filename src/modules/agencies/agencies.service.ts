import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface StopInfo {
	stop_id: string;
	stop_name: string;
	stop_lat: number;
	stop_lon: number;
}

export interface RouteInfo {
	route_id: string;
	route_short_name: string;
	route_long_name: string;
	route_type: number;
	stops: StopInfo[];
}

export interface AgencyInfo {
	agency_id: string;
	agency_name: string;
	routes: RouteInfo[];
}

@Injectable()
export class AgenciesService {
	private readonly logger = new Logger(AgenciesService.name);

	constructor(private readonly prisma: PrismaService) {}

	async listAgencies(): Promise<AgencyInfo[]> {
		this.logger.log('Fetching agencies with routes and stops...');

		// Récupérer toutes les agencies
		const agencies = await this.prisma.$queryRawUnsafe(`
			SELECT agency_id, agency_name 
			FROM agency 
			ORDER BY agency_name
		`) as Array<{ agency_id: string; agency_name: string }>;

		const result: AgencyInfo[] = [];

		for (const agency of agencies) {
			// Récupérer les routes de cette agency
			const routes = await this.prisma.$queryRawUnsafe(`
				SELECT DISTINCT 
					r.route_id, 
					r.route_short_name, 
					r.route_long_name, 
					r.route_type
				FROM routes r 
				WHERE r.agency_id = $1
				ORDER BY r.route_short_name, r.route_long_name
			`, agency.agency_id) as Array<{ route_id: string; route_short_name: string; route_long_name: string; route_type: number }>;

			const routeInfos: RouteInfo[] = [];

			for (const route of routes) {
				// Récupérer les stops distincts pour cette route via stop_times + trips
				const stops = await this.prisma.$queryRawUnsafe(`
					SELECT DISTINCT 
						s.stop_id, 
						s.stop_name, 
						s.stop_lat, 
						s.stop_lon
					FROM stops s
					JOIN stop_times st ON st.stop_id = s.stop_id
					JOIN trips t ON t.trip_id = st.trip_id
					WHERE t.route_id = $1
					ORDER BY s.stop_name
				`, route.route_id) as Array<{ stop_id: string; stop_name: string; stop_lat: string | number; stop_lon: string | number }>;

				const stopInfos: StopInfo[] = stops.map((stop: { stop_id: string; stop_name: string; stop_lat: string | number; stop_lon: string | number }) => ({
					stop_id: stop.stop_id,
					stop_name: stop.stop_name,
					stop_lat: typeof stop.stop_lat === 'string' ? parseFloat(stop.stop_lat) : Number(stop.stop_lat),
					stop_lon: typeof stop.stop_lon === 'string' ? parseFloat(stop.stop_lon) : Number(stop.stop_lon)
				}));

				routeInfos.push({
					route_id: route.route_id,
					route_short_name: route.route_short_name,
					route_long_name: route.route_long_name,
					route_type: route.route_type,
					stops: stopInfos
				});
			}

			result.push({
				agency_id: agency.agency_id,
				agency_name: agency.agency_name,
				routes: routeInfos
			});
		}

		this.logger.log(`Retrieved ${result.length} agencies with their routes and stops`);
		return result;
	}
}
