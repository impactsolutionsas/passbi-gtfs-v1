import { Module } from '@nestjs/common';
import { FaresAdminController } from './fares-admin.controller';
import { FaresAdminService } from './fares-admin.service';

@Module({
	controllers: [FaresAdminController],
	providers: [FaresAdminService],
	exports: [FaresAdminService],
})
export class FaresAdminModule {}
