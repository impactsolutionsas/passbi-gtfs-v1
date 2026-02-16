import { Module } from '@nestjs/common';
import { GtfsGraphController, GtfsGraphAdminController } from './gtfs-graph.controller';
import { GtfsGraphService } from './gtfs-graph.service';
import { GtfsGraphAdminService } from './gtfs-graph-admin.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
	imports: [],
	controllers: [GtfsGraphController, GtfsGraphAdminController],
	providers: [GtfsGraphService, GtfsGraphAdminService, PrismaService],
	exports: [GtfsGraphService, GtfsGraphAdminService],
})
export class GtfsGraphModule {}
