import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { CreateStopDto } from './dto/create-stop.dto';
import { UpdateStopDto } from './dto/update-stop.dto';
import { AgencyQueryDto, RouteQueryDto, StopQueryDto, TripQueryDto } from './dto/query-params.dto';

@Injectable()
export class GtfsAdminService {
	private readonly logger = new Logger(GtfsAdminService.name);

	constructor(private readonly prisma: PrismaService) {}

	// ==================== AGENCIES ====================

	async getAgencies(query: AgencyQueryDto) {
		const page = query.page || 1;
		const limit = query.limit || 20;
		const skip = (page - 1) * limit;

		let whereClause = '';
		const params: any[] = [];
		let paramIndex = 1;

		if (query.search) {
			whereClause = `WHERE agency_name ILIKE $${paramIndex}`;
			params.push(`%${query.search}%`);
			paramIndex++;
		}

		const countQuery = `SELECT COUNT(*) as total FROM agency ${whereClause}`;
		const countResult = await this.prisma.$queryRawUnsafe(countQuery, ...params) as Array<{ total: bigint }>;
		const total = Number(countResult[0]?.total || 0);

		// Use CTE to explicitly exclude unsupported columns
		const dataQuery = `
			WITH agency_data AS (
				SELECT 
					agency_id,
					agency_name,
					agency_url,
					agency_timezone,
					agency_lang,
					agency_phone,
					agency_email
				FROM agency
				${whereClause}
			)
			SELECT 
				a.agency_id::text,
				a.agency_name::text,
				a.agency_url::text,
				a.agency_timezone::text,
				a.agency_lang::text,
				a.agency_phone::text,
				a.agency_email::text,
				(SELECT COUNT(*) FROM routes WHERE agency_id = a.agency_id)::int as routes_count,
				(SELECT COUNT(*) FROM stops WHERE agency_id = a.agency_id)::int as stops_count
			FROM agency_data a
			ORDER BY a.agency_id
			LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
		`;
		params.push(limit, skip);

		const agencies = await this.prisma.$queryRawUnsafe(dataQuery, ...params) as Array<{
			agency_id: string;
			agency_name: string;
			agency_url: string | null;
			agency_timezone: string;
			agency_lang: string | null;
			agency_phone: string | null;
			agency_email: string | null;
			routes_count: number;
			stops_count: number;
		}>;

		return {
			data: agencies,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	async getAgencyById(agencyId: string) {
		const agency = await this.prisma.$queryRawUnsafe(
			`WITH agency_data AS (
				SELECT 
					agency_id,
					agency_name,
					agency_url,
					agency_timezone,
					agency_lang,
					agency_phone,
					agency_email
				FROM agency
				WHERE agency_id = $1
			)
			SELECT 
				a.agency_id::text,
				a.agency_name::text,
				a.agency_url::text,
				a.agency_timezone::text,
				a.agency_lang::text,
				a.agency_phone::text,
				a.agency_email::text,
				(SELECT COUNT(*) FROM routes WHERE agency_id = a.agency_id)::int as routes_count,
				(SELECT COUNT(*) FROM stops WHERE agency_id = a.agency_id)::int as stops_count
			FROM agency_data a`,
			agencyId
		) as Array<{
			agency_id: string;
			agency_name: string;
			agency_url: string | null;
			agency_timezone: string;
			agency_lang: string | null;
			agency_phone: string | null;
			agency_email: string | null;
			routes_count: number;
			stops_count: number;
		}>;

		if (!agency || agency.length === 0) {
			throw new NotFoundException(`Agency with ID ${agencyId} not found`);
		}

		return agency[0];
	}

	async createAgency(dto: CreateAgencyDto) {
		try {
			await this.prisma.$executeRawUnsafe(
				`INSERT INTO agency (
					agency_id, agency_name, agency_timezone, agency_url, 
					agency_lang, agency_phone, agency_email
				) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				dto.agency_id,
				dto.agency_name,
				dto.agency_timezone,
				dto.agency_url || null,
				dto.agency_lang || null,
				dto.agency_phone || null,
				dto.agency_email || null,
			);

			return this.getAgencyById(dto.agency_id);
		} catch (error: any) {
			if (error.code === '23505') { // Unique violation
				throw new BadRequestException(`Agency with ID ${dto.agency_id} already exists`);
			}
			throw error;
		}
	}

	async updateAgency(agencyId: string, dto: UpdateAgencyDto) {
		const existing = await this.getAgencyById(agencyId);

		const updates: string[] = [];
		const params: any[] = [];
		let paramIndex = 1;

		if (dto.agency_name !== undefined) {
			updates.push(`agency_name = $${paramIndex++}`);
			params.push(dto.agency_name);
		}
		if (dto.agency_timezone !== undefined) {
			updates.push(`agency_timezone = $${paramIndex++}`);
			params.push(dto.agency_timezone);
		}
		if (dto.agency_url !== undefined) {
			updates.push(`agency_url = $${paramIndex++}`);
			params.push(dto.agency_url || null);
		}
		if (dto.agency_lang !== undefined) {
			updates.push(`agency_lang = $${paramIndex++}`);
			params.push(dto.agency_lang || null);
		}
		if (dto.agency_phone !== undefined) {
			updates.push(`agency_phone = $${paramIndex++}`);
			params.push(dto.agency_phone || null);
		}
		if (dto.agency_email !== undefined) {
			updates.push(`agency_email = $${paramIndex++}`);
			params.push(dto.agency_email || null);
		}

		if (updates.length === 0) {
			return existing;
		}

		params.push(agencyId);
		await this.prisma.$executeRawUnsafe(
			`UPDATE agency SET ${updates.join(', ')} WHERE agency_id = $${paramIndex}`,
			...params
		);

		return this.getAgencyById(agencyId);
	}

	async deleteAgency(agencyId: string) {
		await this.getAgencyById(agencyId); // Throws if not found

		await this.prisma.$executeRawUnsafe(
			'DELETE FROM agency WHERE agency_id = $1',
			agencyId
		);

		return { message: `Agency ${agencyId} deleted successfully` };
	}

	// ==================== ROUTES ====================

	async getRoutes(query: RouteQueryDto) {
		const page = query.page || 1;
		const limit = query.limit || 20;
		const skip = (page - 1) * limit;

		const conditions: string[] = [];
		const params: any[] = [];
		let paramIndex = 1;

		if (query.agency_id) {
			conditions.push(`agency_id = $${paramIndex++}`);
			params.push(query.agency_id);
		}

		if (query.route_type !== undefined) {
			conditions.push(`route_type = $${paramIndex++}`);
			params.push(query.route_type);
		}

		if (query.search) {
			conditions.push(`(
				route_short_name ILIKE $${paramIndex} OR 
				route_long_name ILIKE $${paramIndex}
			)`);
			params.push(`%${query.search}%`);
			paramIndex++;
		}

		const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

		const countQuery = `SELECT COUNT(*) as total FROM routes ${whereClause}`;
		const countResult = await this.prisma.$queryRawUnsafe(countQuery, ...params) as Array<{ total: bigint }>;
		const total = Number(countResult[0]?.total || 0);

		params.push(limit, skip);
		const dataQuery = `
			WITH route_data AS (
				SELECT 
					route_id,
					agency_id,
					route_short_name,
					route_long_name,
					route_type,
					route_color,
					route_text_color
				FROM routes
				${whereClause}
			)
			SELECT 
				r.route_id::text,
				r.agency_id::text,
				r.route_short_name::text,
				r.route_long_name::text,
				r.route_type::int,
				r.route_color::text,
				r.route_text_color::text,
				a.agency_name::text,
				(SELECT COUNT(*) FROM trips WHERE route_id = r.route_id)::int as trips_count
			FROM route_data r
			LEFT JOIN agency a ON r.agency_id = a.agency_id
			ORDER BY r.agency_id, r.route_id
			LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
		`;

		const routes = await this.prisma.$queryRawUnsafe(dataQuery, ...params) as Array<{
			route_id: string;
			agency_id: string;
			route_short_name: string | null;
			route_long_name: string | null;
			route_type: number;
			route_color: string | null;
			route_text_color: string | null;
			agency_name: string | null;
			trips_count: number;
		}>;

		return {
			data: routes,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	async getRouteById(routeId: string) {
		const route = await this.prisma.$queryRawUnsafe(
			`WITH route_data AS (
				SELECT 
					route_id,
					agency_id,
					route_short_name,
					route_long_name,
					route_type,
					route_color,
					route_text_color
				FROM routes
				WHERE route_id = $1
			)
			SELECT 
				r.route_id::text,
				r.agency_id::text,
				r.route_short_name::text,
				r.route_long_name::text,
				r.route_type::int,
				r.route_color::text,
				r.route_text_color::text,
				a.agency_name::text,
				(SELECT COUNT(*) FROM trips WHERE route_id = r.route_id)::int as trips_count
			FROM route_data r
			LEFT JOIN agency a ON r.agency_id = a.agency_id`,
			routeId
		) as Array<{
			route_id: string;
			agency_id: string;
			route_short_name: string | null;
			route_long_name: string | null;
			route_type: number;
			route_color: string | null;
			route_text_color: string | null;
			agency_name: string | null;
			trips_count: number;
		}>;

		if (!route || route.length === 0) {
			throw new NotFoundException(`Route with ID ${routeId} not found`);
		}

		return route[0];
	}

	async createRoute(dto: CreateRouteDto) {
		// Verify agency exists
		await this.getAgencyById(dto.agency_id);

		try {
			await this.prisma.$executeRawUnsafe(
				`INSERT INTO routes (
					route_id, agency_id, route_short_name, route_long_name,
					route_type, route_color, route_text_color
				) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				dto.route_id,
				dto.agency_id,
				dto.route_short_name || null,
				dto.route_long_name || null,
				dto.route_type,
				dto.route_color || null,
				dto.route_text_color || null,
			);

			return this.getRouteById(dto.route_id);
		} catch (error: any) {
			if (error.code === '23505') {
				throw new BadRequestException(`Route with ID ${dto.route_id} already exists`);
			}
			throw error;
		}
	}

	async updateRoute(routeId: string, dto: UpdateRouteDto) {
		const existing = await this.getRouteById(routeId);

		if (dto.agency_id) {
			await this.getAgencyById(dto.agency_id);
		}

		const updates: string[] = [];
		const params: any[] = [];
		let paramIndex = 1;

		if (dto.agency_id !== undefined) {
			updates.push(`agency_id = $${paramIndex++}`);
			params.push(dto.agency_id);
		}
		if (dto.route_short_name !== undefined) {
			updates.push(`route_short_name = $${paramIndex++}`);
			params.push(dto.route_short_name || null);
		}
		if (dto.route_long_name !== undefined) {
			updates.push(`route_long_name = $${paramIndex++}`);
			params.push(dto.route_long_name || null);
		}
		if (dto.route_type !== undefined) {
			updates.push(`route_type = $${paramIndex++}`);
			params.push(dto.route_type);
		}
		if (dto.route_color !== undefined) {
			updates.push(`route_color = $${paramIndex++}`);
			params.push(dto.route_color || null);
		}
		if (dto.route_text_color !== undefined) {
			updates.push(`route_text_color = $${paramIndex++}`);
			params.push(dto.route_text_color || null);
		}

		if (updates.length === 0) {
			return existing;
		}

		params.push(routeId);
		await this.prisma.$executeRawUnsafe(
			`UPDATE routes SET ${updates.join(', ')} WHERE route_id = $${paramIndex}`,
			...params
		);

		return this.getRouteById(routeId);
	}

	async deleteRoute(routeId: string) {
		await this.getRouteById(routeId);

		await this.prisma.$executeRawUnsafe(
			'DELETE FROM routes WHERE route_id = $1',
			routeId
		);

		return { message: `Route ${routeId} deleted successfully` };
	}

	// ==================== STOPS ====================

	async getStops(query: StopQueryDto) {
		const page = query.page || 1;
		const limit = query.limit || 20;
		const skip = (page - 1) * limit;

		const conditions: string[] = [];
		const params: any[] = [];
		let paramIndex = 1;

		if (query.agency_id) {
			conditions.push(`agency_id = $${paramIndex++}`);
			params.push(query.agency_id);
		}

		if (query.search) {
			conditions.push(`(
				stop_name ILIKE $${paramIndex} OR 
				stop_code ILIKE $${paramIndex}
			)`);
			params.push(`%${query.search}%`);
			paramIndex++;
		}

		const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

		const countQuery = `SELECT COUNT(*) as total FROM stops ${whereClause}`;
		const countResult = await this.prisma.$queryRawUnsafe(countQuery, ...params) as Array<{ total: bigint }>;
		const total = Number(countResult[0]?.total || 0);

		params.push(limit, skip);
		const dataQuery = `
			WITH stop_data AS (
				SELECT 
					stop_id,
					agency_id,
					stop_code,
					stop_name,
					stop_desc,
					stop_lat,
					stop_lon,
					location_type,
					parent_station,
					zone_id
				FROM stops
				${whereClause}
			)
			SELECT 
				s.stop_id::text,
				s.agency_id::text,
				s.stop_code::text,
				s.stop_name::text,
				s.stop_desc::text,
				s.stop_lat::double precision,
				s.stop_lon::double precision,
				s.location_type::int,
				s.parent_station::text,
				s.zone_id::text,
				a.agency_name::text
			FROM stop_data s
			LEFT JOIN agency a ON s.agency_id = a.agency_id
			ORDER BY s.agency_id, s.stop_id
			LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
		`;

		const stops = await this.prisma.$queryRawUnsafe(dataQuery, ...params) as Array<{
			stop_id: string;
			agency_id: string;
			stop_code: string | null;
			stop_name: string;
			stop_desc: string | null;
			stop_lat: number;
			stop_lon: number;
			location_type: number | null;
			parent_station: string | null;
			zone_id: string | null;
			agency_name: string | null;
		}>;

		return {
			data: stops,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	async getStopById(stopId: string) {
		const stop = await this.prisma.$queryRawUnsafe(
			`WITH stop_data AS (
				SELECT 
					stop_id,
					agency_id,
					stop_code,
					stop_name,
					stop_desc,
					stop_lat,
					stop_lon,
					location_type,
					parent_station,
					zone_id
				FROM stops
				WHERE stop_id = $1
			)
			SELECT 
				s.stop_id::text,
				s.agency_id::text,
				s.stop_code::text,
				s.stop_name::text,
				s.stop_desc::text,
				s.stop_lat::double precision,
				s.stop_lon::double precision,
				s.location_type::int,
				s.parent_station::text,
				s.zone_id::text,
				a.agency_name::text
			FROM stop_data s
			LEFT JOIN agency a ON s.agency_id = a.agency_id`,
			stopId
		) as Array<{
			stop_id: string;
			agency_id: string;
			stop_code: string | null;
			stop_name: string;
			stop_desc: string | null;
			stop_lat: number;
			stop_lon: number;
			location_type: number | null;
			parent_station: string | null;
			zone_id: string | null;
			agency_name: string | null;
		}>;

		if (!stop || stop.length === 0) {
			throw new NotFoundException(`Stop with ID ${stopId} not found`);
		}

		return stop[0];
	}

	async createStop(dto: CreateStopDto) {
		// Verify agency exists
		await this.getAgencyById(dto.agency_id);

		try {
			// Insert stop - PostGIS will auto-generate geom
			await this.prisma.$executeRawUnsafe(
				`INSERT INTO stops (
					stop_id, agency_id, stop_code, stop_name, stop_desc,
					stop_lat, stop_lon, location_type, parent_station, zone_id
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
				dto.stop_id,
				dto.agency_id,
				dto.stop_code || null,
				dto.stop_name,
				dto.stop_desc || null,
				dto.stop_lat,
				dto.stop_lon,
				dto.location_type || 0,
				dto.parent_station || null,
				dto.zone_id || null,
			);

			return this.getStopById(dto.stop_id);
		} catch (error: any) {
			if (error.code === '23505') {
				throw new BadRequestException(`Stop with ID ${dto.stop_id} already exists`);
			}
			throw error;
		}
	}

	async updateStop(stopId: string, dto: UpdateStopDto) {
		const existing = await this.getStopById(stopId);

		if (dto.agency_id) {
			await this.getAgencyById(dto.agency_id);
		}

		const updates: string[] = [];
		const params: any[] = [];
		let paramIndex = 1;

		if (dto.agency_id !== undefined) {
			updates.push(`agency_id = $${paramIndex++}`);
			params.push(dto.agency_id);
		}
		if (dto.stop_code !== undefined) {
			updates.push(`stop_code = $${paramIndex++}`);
			params.push(dto.stop_code || null);
		}
		if (dto.stop_name !== undefined) {
			updates.push(`stop_name = $${paramIndex++}`);
			params.push(dto.stop_name);
		}
		if (dto.stop_desc !== undefined) {
			updates.push(`stop_desc = $${paramIndex++}`);
			params.push(dto.stop_desc || null);
		}
		if (dto.stop_lat !== undefined) {
			updates.push(`stop_lat = $${paramIndex++}`);
			params.push(dto.stop_lat);
		}
		if (dto.stop_lon !== undefined) {
			updates.push(`stop_lon = $${paramIndex++}`);
			params.push(dto.stop_lon);
		}
		if (dto.location_type !== undefined) {
			updates.push(`location_type = $${paramIndex++}`);
			params.push(dto.location_type);
		}
		if (dto.parent_station !== undefined) {
			updates.push(`parent_station = $${paramIndex++}`);
			params.push(dto.parent_station || null);
		}
		if (dto.zone_id !== undefined) {
			updates.push(`zone_id = $${paramIndex++}`);
			params.push(dto.zone_id || null);
		}

		if (updates.length === 0) {
			return existing;
		}

		// If lat/lon changed, we need to update geom
		if (dto.stop_lat !== undefined || dto.stop_lon !== undefined) {
			updates.push(`geom = ST_SetSRID(ST_MakePoint(stop_lon, stop_lat), 4326)`);
		}

		params.push(stopId);
		await this.prisma.$executeRawUnsafe(
			`UPDATE stops SET ${updates.join(', ')} WHERE stop_id = $${paramIndex}`,
			...params
		);

		return this.getStopById(stopId);
	}

	async deleteStop(stopId: string) {
		await this.getStopById(stopId);

		await this.prisma.$executeRawUnsafe(
			'DELETE FROM stops WHERE stop_id = $1',
			stopId
		);

		return { message: `Stop ${stopId} deleted successfully` };
	}

	// ==================== TRIPS ====================

	async getTrips(query: TripQueryDto) {
		const page = query.page || 1;
		const limit = query.limit || 20;
		const skip = (page - 1) * limit;

		const conditions: string[] = [];
		const params: any[] = [];
		let paramIndex = 1;

		if (query.route_id) {
			conditions.push(`t.route_id = $${paramIndex++}`);
			params.push(query.route_id);
		}

		if (query.service_id) {
			conditions.push(`t.service_id = $${paramIndex++}`);
			params.push(query.service_id);
		}

		const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

		const countQuery = `SELECT COUNT(*) as total FROM trips t ${whereClause}`;
		const countResult = await this.prisma.$queryRawUnsafe(countQuery, ...params) as Array<{ total: bigint }>;
		const total = Number(countResult[0]?.total || 0);

		params.push(limit, skip);
		const dataQuery = `
			SELECT 
				t.trip_id::text,
				t.route_id::text,
				t.service_id::text,
				t.trip_headsign::text,
				t.trip_short_name::text,
				t.direction_id::int,
				t.block_id::text,
				t.shape_id::text,
				t.wheelchair_accessible::int,
				t.bikes_allowed::int,
				r.route_short_name::text,
				r.route_long_name::text,
				r.agency_id::text,
				(SELECT COUNT(*) FROM stop_times WHERE trip_id = t.trip_id)::int as stop_times_count
			FROM trips t
			LEFT JOIN routes r ON t.route_id = r.route_id
			${whereClause}
			ORDER BY t.route_id, t.trip_id
			LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
		`;

		const trips = await this.prisma.$queryRawUnsafe(dataQuery, ...params) as Array<{
			trip_id: string;
			route_id: string;
			service_id: string;
			trip_headsign: string | null;
			trip_short_name: string | null;
			direction_id: number | null;
			block_id: string | null;
			shape_id: string | null;
			wheelchair_accessible: number | null;
			bikes_allowed: number | null;
			route_short_name: string | null;
			route_long_name: string | null;
			agency_id: string | null;
			stop_times_count: number;
		}>;

		return {
			data: trips,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	async getTripById(tripId: string) {
		const trip = await this.prisma.$queryRawUnsafe(
			`SELECT 
				t.trip_id::text,
				t.route_id::text,
				t.service_id::text,
				t.trip_headsign::text,
				t.trip_short_name::text,
				t.direction_id::int,
				t.block_id::text,
				t.shape_id::text,
				t.wheelchair_accessible::int,
				t.bikes_allowed::int,
				r.route_short_name::text,
				r.route_long_name::text,
				r.agency_id::text,
				(SELECT COUNT(*) FROM stop_times WHERE trip_id = t.trip_id)::int as stop_times_count
			FROM trips t
			LEFT JOIN routes r ON t.route_id = r.route_id
			WHERE t.trip_id = $1`,
			tripId
		) as Array<{
			trip_id: string;
			route_id: string;
			service_id: string;
			trip_headsign: string | null;
			trip_short_name: string | null;
			direction_id: number | null;
			block_id: string | null;
			shape_id: string | null;
			wheelchair_accessible: number | null;
			bikes_allowed: number | null;
			route_short_name: string | null;
			route_long_name: string | null;
			agency_id: string | null;
			stop_times_count: number;
		}>;

		if (!trip || trip.length === 0) {
			throw new NotFoundException(`Trip with ID ${tripId} not found`);
		}

		return trip[0];
	}
}
