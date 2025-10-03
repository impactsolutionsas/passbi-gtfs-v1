import { Module } from '@nestjs/common';
import { GtfsGraphController } from './gtfs-graph.controller';
import { GtfsGraphService } from './gtfs-graph.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
	imports: [],
	controllers: [GtfsGraphController],
	providers: [GtfsGraphService, PrismaService],
	exports: [GtfsGraphService],
})
export class GtfsGraphModule {}
