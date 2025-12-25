import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './common/prisma.service';
import { GtfsModule } from './modules/gtfs/gtfs.module';
import { GtfsGraphModule } from './modules/gtfs-graph/gtfs-graph.module';
import { RoutingModule } from './modules/routing/routing.module';
import { AdminModule } from './modules/admin/admin.module';
import { AgenciesModule } from './modules/agencies/agencies.module';
import { VtcModule } from './modules/vtc/vtc.module';
import { SearchModule } from './modules/search/search.module';

@Module({
  imports: [GtfsModule, GtfsGraphModule, RoutingModule, AdminModule, AgenciesModule, VtcModule, SearchModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
