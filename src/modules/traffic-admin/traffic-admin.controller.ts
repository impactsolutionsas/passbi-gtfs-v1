import {
	Controller,
	Get,
	Post,
	Put,
	Delete,
	Body,
	Param,
	Query,
	UseGuards,
	UsePipes,
	ValidationPipe,
} from '@nestjs/common';
import { TrafficAdminService } from './traffic-admin.service';
import { AdminGuard } from '../../common/guards/admin.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { UserRole, AdminUser } from '../../common/supabase-admin.service';
import {
	CreateTrafficAnnouncementDto,
	UpdateTrafficAnnouncementDto,
	TrafficAnnouncementQueryDto,
} from './dto/traffic-announcement.dto';

@Controller('admin/traffic')
@UseGuards(AdminGuard)
@UsePipes(new ValidationPipe({ transform: true }))
export class TrafficAdminController {
	constructor(private readonly trafficAdminService: TrafficAdminService) {}

	@Get('announcements')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.VIEWER)
	async getAnnouncements(@Query() query: TrafficAnnouncementQueryDto) {
		return this.trafficAdminService.getAnnouncements(query);
	}

	@Get('announcements/:id')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.VIEWER)
	async getAnnouncementById(@Param('id') id: string) {
		return this.trafficAdminService.getAnnouncementById(id);
	}

	@Post('announcements')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
	async createAnnouncement(
		@Body() dto: CreateTrafficAnnouncementDto,
		@CurrentUser() user: AdminUser,
	) {
		return this.trafficAdminService.createAnnouncement(dto, user.id);
	}

	@Put('announcements/:id')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
	async updateAnnouncement(
		@Param('id') id: string,
		@Body() dto: UpdateTrafficAnnouncementDto,
	) {
		return this.trafficAdminService.updateAnnouncement(id, dto);
	}

	@Delete('announcements/:id')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
	async deleteAnnouncement(@Param('id') id: string) {
		return this.trafficAdminService.deleteAnnouncement(id);
	}
}
