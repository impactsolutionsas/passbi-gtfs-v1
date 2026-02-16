import { Module } from '@nestjs/common';
import { AnalyticsAdminController } from './analytics-admin.controller';
import { AnalyticsAdminService } from './analytics-admin.service';

@Module({
	controllers: [AnalyticsAdminController],
	providers: [AnalyticsAdminService],
	exports: [AnalyticsAdminService],
})
export class AnalyticsAdminModule {}
