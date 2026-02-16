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
import { FaresAdminService } from './fares-admin.service';
import { AdminGuard } from '../../common/guards/admin.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/supabase-admin.service';
import { CreateFareDto, UpdateFareDto, FareQueryDto } from './dto/fare.dto';

@Controller('admin/fares')
@UseGuards(AdminGuard)
@UsePipes(new ValidationPipe({ transform: true }))
export class FaresAdminController {
	constructor(private readonly faresAdminService: FaresAdminService) {}

	@Get()
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.VIEWER)
	async getFares(@Query() query: FareQueryDto) {
		return this.faresAdminService.getFares(query);
	}

	@Get(':id')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.VIEWER)
	async getFareById(@Param('id') id: string) {
		return this.faresAdminService.getFareById(id);
	}

	@Get(':id/history')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.VIEWER)
	async getFareHistory(@Param('id') id: string) {
		return this.faresAdminService.getFareHistory(id);
	}

	@Post()
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
	async createFare(@Body() dto: CreateFareDto) {
		return this.faresAdminService.createFare(dto);
	}

	@Put(':id')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
	async updateFare(@Param('id') id: string, @Body() dto: UpdateFareDto) {
		return this.faresAdminService.updateFare(id, dto);
	}

	@Delete(':id')
	@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
	async deleteFare(@Param('id') id: string) {
		return this.faresAdminService.deleteFare(id);
	}
}
