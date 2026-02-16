import {
	Controller,
	Get,
	Query,
	UseGuards,
	UsePipes,
	ValidationPipe,
} from '@nestjs/common';
import { AnalyticsAdminService } from './analytics-admin.service';
import { AdminGuard } from '../../common/guards/admin.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/supabase-admin.service';
import { AnalyticsQueryDto, ExportQueryDto } from './dto/analytics-query.dto';

@Controller('admin/analytics')
@UseGuards(AdminGuard)
@UsePipes(new ValidationPipe({ transform: true }))
export class AnalyticsAdminController {
	constructor(private readonly analyticsAdminService: AnalyticsAdminService) {}

	@Get('overview')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.VIEWER)
	async getOverview(@Query() query: AnalyticsQueryDto) {
		return this.analyticsAdminService.getOverview(query);
	}

	@Get('onboarding')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.VIEWER)
	async getOnboardingStats(@Query() query: AnalyticsQueryDto) {
		return this.analyticsAdminService.getOnboardingStats(query);
	}

	@Get('sessions')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.VIEWER)
	async getSessionsStats(@Query() query: AnalyticsQueryDto) {
		return this.analyticsAdminService.getSessionsStats(query);
	}

	@Get('events')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.VIEWER)
	async getEventsStats(@Query() query: AnalyticsQueryDto) {
		return this.analyticsAdminService.getEventsStats(query);
	}

	@Get('trends')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.VIEWER)
	async getTrends(@Query() query: AnalyticsQueryDto) {
		return this.analyticsAdminService.getTrends(query);
	}

	@Get('export')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
	async exportData(@Query() query: ExportQueryDto) {
		return this.analyticsAdminService.exportData(query);
	}
}
