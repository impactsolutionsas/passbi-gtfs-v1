import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseAdminService } from '../../common/supabase-admin.service';
import { CreateFareDto, UpdateFareDto, FareQueryDto } from './dto/fare.dto';

@Injectable()
export class FaresAdminService {
	private readonly logger = new Logger(FaresAdminService.name);

	constructor(private readonly supabaseAdmin: SupabaseAdminService) {}

	async getFares(query: FareQueryDto) {
		const page = query.page || 1;
		const limit = query.limit || 20;
		const offset = (page - 1) * limit;

		const supabase = this.supabaseAdmin.getAdminClient();
		let queryBuilder = supabase
			.from('fare_pricing')
			.select('*', { count: 'exact' })
			.order('created_at', { ascending: false })
			.range(offset, offset + limit - 1);

		if (query.agency_id) {
			queryBuilder = queryBuilder.eq('agency_id', query.agency_id);
		}

		if (query.route_id) {
			queryBuilder = queryBuilder.eq('route_id', query.route_id);
		}

		if (query.fare_type) {
			queryBuilder = queryBuilder.eq('fare_type', query.fare_type);
		}

		if (query.is_active !== undefined) {
			queryBuilder = queryBuilder.eq('is_active', query.is_active);
		}

		const { data, error, count } = await queryBuilder;

		if (error) {
			this.logger.error(`Error fetching fares: ${error.message}`);
			throw new Error(`Failed to fetch fares: ${error.message}`);
		}

		return {
			data: data || [],
			pagination: {
				page,
				limit,
				total: count || 0,
				totalPages: Math.ceil((count || 0) / limit),
			},
		};
	}

	async getFareById(id: string) {
		const supabase = this.supabaseAdmin.getAdminClient();
		const { data, error } = await supabase
			.from('fare_pricing')
			.select('*')
			.eq('id', id)
			.single();

		if (error) {
			if (error.code === 'PGRST116') {
				throw new NotFoundException(`Fare with ID ${id} not found`);
			}
			this.logger.error(`Error fetching fare: ${error.message}`);
			throw new Error(`Failed to fetch fare: ${error.message}`);
		}

		return data;
	}

	async createFare(dto: CreateFareDto) {
		const supabase = this.supabaseAdmin.getAdminClient();
		const { data, error } = await supabase
			.from('fare_pricing')
			.insert({
				agency_id: dto.agency_id,
				route_id: dto.route_id || null,
				fare_type: dto.fare_type,
				price_cfa: dto.price_cfa,
				currency: dto.currency || 'XOF',
				description: dto.description || null,
				is_active: dto.is_active !== undefined ? dto.is_active : true,
				valid_from: dto.valid_from || null,
				valid_until: dto.valid_until || null,
			})
			.select()
			.single();

		if (error) {
			this.logger.error(`Error creating fare: ${error.message}`);
			throw new Error(`Failed to create fare: ${error.message}`);
		}

		return data;
	}

	async updateFare(id: string, dto: UpdateFareDto) {
		await this.getFareById(id); // Verify exists

		const supabase = this.supabaseAdmin.getAdminClient();
		const updateData: any = {};

		if (dto.agency_id !== undefined) updateData.agency_id = dto.agency_id;
		if (dto.route_id !== undefined) updateData.route_id = dto.route_id || null;
		if (dto.fare_type !== undefined) updateData.fare_type = dto.fare_type;
		if (dto.price_cfa !== undefined) updateData.price_cfa = dto.price_cfa;
		if (dto.currency !== undefined) updateData.currency = dto.currency;
		if (dto.description !== undefined) updateData.description = dto.description || null;
		if (dto.is_active !== undefined) updateData.is_active = dto.is_active;
		if (dto.valid_from !== undefined) updateData.valid_from = dto.valid_from || null;
		if (dto.valid_until !== undefined) updateData.valid_until = dto.valid_until || null;

		const { data, error } = await supabase
			.from('fare_pricing')
			.update(updateData)
			.eq('id', id)
			.select()
			.single();

		if (error) {
			this.logger.error(`Error updating fare: ${error.message}`);
			throw new Error(`Failed to update fare: ${error.message}`);
		}

		return data;
	}

	async deleteFare(id: string) {
		await this.getFareById(id); // Verify exists

		const supabase = this.supabaseAdmin.getAdminClient();
		const { error } = await supabase
			.from('fare_pricing')
			.delete()
			.eq('id', id);

		if (error) {
			this.logger.error(`Error deleting fare: ${error.message}`);
			throw new Error(`Failed to delete fare: ${error.message}`);
		}

		return { message: `Fare ${id} deleted successfully` };
	}

	async getFareHistory(id: string) {
		// Note: This would require a history/audit table in Supabase
		// For now, we'll return the current fare with created_at/updated_at
		const fare = await this.getFareById(id);
		return {
			current: fare,
			history: [
				{
					action: 'created',
					timestamp: fare.created_at,
					data: fare,
				},
				...(fare.updated_at && fare.updated_at !== fare.created_at
					? [
							{
								action: 'updated',
								timestamp: fare.updated_at,
								data: fare,
							},
					  ]
					: []),
			],
		};
	}
}
