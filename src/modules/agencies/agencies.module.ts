import { Module } from '@nestjs/common';
import { AgenciesController } from './agencies.controller';
import { AgenciesService } from './agencies.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
	controllers: [AgenciesController],
	providers: [AgenciesService, PrismaService],
	exports: [AgenciesService],
})
export class AgenciesModule {}
