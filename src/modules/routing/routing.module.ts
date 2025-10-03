import { Module } from '@nestjs/common';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';
import { PrismaService } from '../../common/prisma.service';
import { VtcService } from '../vtc/vtc.service';

@Module({
	imports: [],
	controllers: [RoutingController],
	providers: [RoutingService, PrismaService, VtcService],
	exports: [RoutingService],
})
export class RoutingModule {}
