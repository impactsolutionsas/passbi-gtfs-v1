import { Module } from '@nestjs/common';
import { GtfsAdminController } from './gtfs-admin.controller';
import { GtfsAdminService } from './gtfs-admin.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
	controllers: [GtfsAdminController],
	providers: [GtfsAdminService, PrismaService],
	exports: [GtfsAdminService],
})
export class GtfsAdminModule {}
