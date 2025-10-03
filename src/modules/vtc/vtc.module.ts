import { Module } from '@nestjs/common';
import { VtcController } from './vtc.controller';
import { VtcService } from './vtc.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
	controllers: [VtcController],
	providers: [VtcService, PrismaService],
	exports: [VtcService],
})
export class VtcModule {}
