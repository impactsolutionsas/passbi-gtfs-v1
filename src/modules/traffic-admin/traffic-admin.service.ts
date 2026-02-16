import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseAdminService } from '../../common/supabase-admin.service';
import { CreateTrafficAnnouncementDto, UpdateTrafficAnnouncementDto, TrafficAnnouncementQueryDto } from './dto/traffic-announcement.dto';

@Injectable()
export class TrafficAdminService {
	private readonly logger = new Logger(TrafficAdminService.name);

	constructor(private readonly supabaseAdmin: SupabaseAdminService) {}

	async getAnnouncements(query: TrafficAnnouncementQueryDto) {
		const page = query.page || 1;
		const limit = query.limit || 20;
		const offset = (page - 1) * limit;

		const supabase = this.supabaseAdmin.getAdminClient();
		let queryBuilder = supabase
			.from('traffic_announcements')
			.select('*', { count: 'exact' })
			.order('priority', { ascending: false })
			.order('created_at', { ascending: false })
			.range(offset, offset + limit - 1);

		if (query.agency_id) {
			queryBuilder = queryBuilder.eq('agency_id', query.agency_id);
		}

		if (query.announcement_type) {
			queryBuilder = queryBuilder.eq('announcement_type', query.announcement_type);
		}

		if (query.is_active !== undefined) {
			queryBuilder = queryBuilder.eq('is_active', query.is_active);
		}

		const { data, error, count } = await queryBuilder;

		if (error) {
			this.logger.error(`Error fetching announcements: ${error.message}`);
			throw new Error(`Failed to fetch announcements: ${error.message}`);
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

	async getAnnouncementById(id: string) {
		const supabase = this.supabaseAdmin.getAdminClient();
		const { data, error } = await supabase
			.from('traffic_announcements')
			.select('*')
			.eq('id', id)
			.single();

		if (error) {
			if (error.code === 'PGRST116') {
				throw new NotFoundException(`Announcement with ID ${id} not found`);
			}
			this.logger.error(`Error fetching announcement: ${error.message}`);
			throw new Error(`Failed to fetch announcement: ${error.message}`);
		}

		return data;
	}

	async createAnnouncement(dto: CreateTrafficAnnouncementDto, userId: string) {
		const supabase = this.supabaseAdmin.getAdminClient();
		const { data, error } = await supabase
			.from('traffic_announcements')
			.insert({
				title: dto.title,
				description: dto.description,
				announcement_type: dto.announcement_type,
				agency_id: dto.agency_id || null,
				image_url: dto.image_url || null,
				start_date: dto.start_date,
				end_date: dto.end_date || null,
				is_active: dto.is_active !== undefined ? dto.is_active : true,
				priority: dto.priority || 0,
				created_by: userId,
			})
			.select()
			.single();

		if (error) {
			this.logger.error(`Error creating announcement: ${error.message}`);
			throw new Error(`Failed to create announcement: ${error.message}`);
		}

		return data;
	}

	async updateAnnouncement(id: string, dto: UpdateTrafficAnnouncementDto) {
		await this.getAnnouncementById(id); // Verify exists

		const supabase = this.supabaseAdmin.getAdminClient();
		const updateData: any = {};

		if (dto.title !== undefined) updateData.title = dto.title;
		if (dto.description !== undefined) updateData.description = dto.description;
		if (dto.announcement_type !== undefined) updateData.announcement_type = dto.announcement_type;
		if (dto.agency_id !== undefined) updateData.agency_id = dto.agency_id || null;
		if (dto.image_url !== undefined) updateData.image_url = dto.image_url || null;
		if (dto.start_date !== undefined) updateData.start_date = dto.start_date;
		if (dto.end_date !== undefined) updateData.end_date = dto.end_date || null;
		if (dto.is_active !== undefined) updateData.is_active = dto.is_active;
		if (dto.priority !== undefined) updateData.priority = dto.priority;

		const { data, error } = await supabase
			.from('traffic_announcements')
			.update(updateData)
			.eq('id', id)
			.select()
			.single();

		if (error) {
			this.logger.error(`Error updating announcement: ${error.message}`);
			throw new Error(`Failed to update announcement: ${error.message}`);
		}

		return data;
	}

	async deleteAnnouncement(id: string) {
		await this.getAnnouncementById(id); // Verify exists

		const supabase = this.supabaseAdmin.getAdminClient();
		const { error } = await supabase
			.from('traffic_announcements')
			.delete()
			.eq('id', id);

		if (error) {
			this.logger.error(`Error deleting announcement: ${error.message}`);
			throw new Error(`Failed to delete announcement: ${error.message}`);
		}

		return { message: `Announcement ${id} deleted successfully` };
	}
}
