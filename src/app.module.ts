import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './common/prisma.service';
import { CommonModule } from './common/common.module';
import { GtfsModule } from './modules/gtfs/gtfs.module';
import { GtfsGraphModule } from './modules/gtfs-graph/gtfs-graph.module';
import { RoutingModule } from './modules/routing/routing.module';
import { AdminModule } from './modules/admin/admin.module';
import { AgenciesModule } from './modules/agencies/agencies.module';
import { VtcModule } from './modules/vtc/vtc.module';
import { SearchModule } from './modules/search/search.module';
import { GtfsAdminModule } from './modules/gtfs-admin/gtfs-admin.module';
import { TrafficAdminModule } from './modules/traffic-admin/traffic-admin.module';
import { FaresAdminModule } from './modules/fares-admin/fares-admin.module';
import { AnalyticsAdminModule } from './modules/analytics-admin/analytics-admin.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CommonModule,
    GtfsModule,
    GtfsGraphModule,
    RoutingModule,
    AdminModule,
    AgenciesModule,
    VtcModule,
    SearchModule,
    GtfsAdminModule,
    TrafficAdminModule,
    FaresAdminModule,
    AnalyticsAdminModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
