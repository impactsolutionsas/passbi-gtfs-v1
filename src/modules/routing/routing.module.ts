import { Module } from '@nestjs/common';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';
import { RoutingCacheService } from './routing-cache.service';
import { RoutingScoringService } from './routing-scoring.service';
import { RoutingLearningService } from './routing-learning.service';
import { RoutingCleanupService } from './routing-cleanup.service';
import { PrismaService } from '../../common/prisma.service';
import { VtcService } from '../vtc/vtc.service';

@Module({
	imports: [],
	controllers: [RoutingController],
	providers: [
		RoutingService,
		RoutingCacheService,
		RoutingScoringService,
		RoutingLearningService,
		RoutingCleanupService,
		PrismaService,
		VtcService,
	],
	exports: [RoutingService],
})
export class RoutingModule {}
