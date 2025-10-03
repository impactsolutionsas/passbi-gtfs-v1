import { Module } from '@nestjs/common';
import { GtfsController } from './gtfs.controller';
import { GtfsService } from './gtfs.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
	imports: [],
	controllers: [GtfsController],
	providers: [GtfsService, PrismaService],
	exports: [GtfsService],
})
export class GtfsModule {}