import { Module } from '@nestjs/common';
import { TrafficAdminController } from './traffic-admin.controller';
import { TrafficAdminService } from './traffic-admin.service';

@Module({
	controllers: [TrafficAdminController],
	providers: [TrafficAdminService],
	exports: [TrafficAdminService],
})
export class TrafficAdminModule {}
