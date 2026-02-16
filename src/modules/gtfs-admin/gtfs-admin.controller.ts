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
import { GtfsAdminService } from './gtfs-admin.service';
import { AdminGuard } from '../../common/guards/admin.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/supabase-admin.service';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { CreateStopDto } from './dto/create-stop.dto';
import { UpdateStopDto } from './dto/update-stop.dto';
import { AgencyQueryDto, RouteQueryDto, StopQueryDto, TripQueryDto } from './dto/query-params.dto';

@Controller('admin/gtfs')
@UseGuards(AdminGuard)
@UsePipes(new ValidationPipe({ transform: true }))
export class GtfsAdminController {
	constructor(private readonly gtfsAdminService: GtfsAdminService) {}

	// ==================== AGENCIES ====================

	@Get('agencies')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.VIEWER)
	async getAgencies(@Query() query: AgencyQueryDto) {
		return this.gtfsAdminService.getAgencies(query);
	}

	@Get('agencies/:id')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.VIEWER)
	async getAgencyById(@Param('id') id: string) {
		return this.gtfsAdminService.getAgencyById(id);
	}

	@Post('agencies')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
	async createAgency(@Body() dto: CreateAgencyDto) {
		return this.gtfsAdminService.createAgency(dto);
	}

	@Put('agencies/:id')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
	async updateAgency(@Param('id') id: string, @Body() dto: UpdateAgencyDto) {
		return this.gtfsAdminService.updateAgency(id, dto);
	}

	@Delete('agencies/:id')
	@Roles(UserRole.SUPER_ADMIN)
	async deleteAgency(@Param('id') id: string) {
		return this.gtfsAdminService.deleteAgency(id);
	}

	// ==================== ROUTES ====================

	@Get('routes')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.VIEWER)
	async getRoutes(@Query() query: RouteQueryDto) {
		return this.gtfsAdminService.getRoutes(query);
	}

	@Get('routes/:id')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.VIEWER)
	async getRouteById(@Param('id') id: string) {
		return this.gtfsAdminService.getRouteById(id);
	}

	@Post('routes')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
	async createRoute(@Body() dto: CreateRouteDto) {
		return this.gtfsAdminService.createRoute(dto);
	}

	@Put('routes/:id')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
	async updateRoute(@Param('id') id: string, @Body() dto: UpdateRouteDto) {
		return this.gtfsAdminService.updateRoute(id, dto);
	}

	@Delete('routes/:id')
	@Roles(UserRole.SUPER_ADMIN)
	async deleteRoute(@Param('id') id: string) {
		return this.gtfsAdminService.deleteRoute(id);
	}

	// ==================== STOPS ====================

	@Get('stops')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.VIEWER)
	async getStops(@Query() query: StopQueryDto) {
		return this.gtfsAdminService.getStops(query);
	}

	@Get('stops/:id')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.VIEWER)
	async getStopById(@Param('id') id: string) {
		return this.gtfsAdminService.getStopById(id);
	}

	@Post('stops')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
	async createStop(@Body() dto: CreateStopDto) {
		return this.gtfsAdminService.createStop(dto);
	}

	@Put('stops/:id')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
	async updateStop(@Param('id') id: string, @Body() dto: UpdateStopDto) {
		return this.gtfsAdminService.updateStop(id, dto);
	}

	@Delete('stops/:id')
	@Roles(UserRole.SUPER_ADMIN)
	async deleteStop(@Param('id') id: string) {
		return this.gtfsAdminService.deleteStop(id);
	}

	// ==================== TRIPS ====================

	@Get('trips')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.VIEWER)
	async getTrips(@Query() query: TripQueryDto) {
		return this.gtfsAdminService.getTrips(query);
	}

	@Get('trips/:id')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.VIEWER)
	async getTripById(@Param('id') id: string) {
		return this.gtfsAdminService.getTripById(id);
	}
}
