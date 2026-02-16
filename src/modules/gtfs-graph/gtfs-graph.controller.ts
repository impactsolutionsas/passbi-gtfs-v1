import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { GtfsGraphService } from './gtfs-graph.service';
import { GtfsGraphAdminService } from './gtfs-graph-admin.service';
import { AdminGuard } from '../../common/guards/admin.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/supabase-admin.service';

@Controller('gtfs')
export class GtfsGraphController {
	constructor(private readonly graphService: GtfsGraphService) {}

	@Post('build-graph')
	async buildGraph() {
		return this.graphService.buildGraph();
	}
}

@Controller('admin/graph')
@UseGuards(AdminGuard)
export class GtfsGraphAdminController {
	constructor(private readonly graphAdminService: GtfsGraphAdminService) {}

	@Post('rebuild')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
	async rebuildGraph() {
		return this.graphAdminService.rebuildGraph();
	}

	@Get('stats')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.VIEWER)
	async getGraphStats() {
		return this.graphAdminService.getGraphStats();
	}

	@Get('validate')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.VIEWER)
	async validateGraph() {
		return this.graphAdminService.validateGraph();
	}

	@Get('cache/stats')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.VIEWER)
	async getCacheStats() {
		return this.graphAdminService.getCacheStats();
	}

	@Post('cache/invalidate')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
	async invalidateCache() {
		return this.graphAdminService.invalidateCache();
	}
}
