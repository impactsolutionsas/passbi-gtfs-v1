import { Body, Controller, Get, Post } from '@nestjs/common';
import { ImportGtfsDto } from './dto/import-gtfs.dto';
import { GtfsService } from './gtfs.service';

@Controller('gtfs')
export class GtfsController {
	constructor(private readonly gtfsService: GtfsService) {}

	@Post('import')
	async import(@Body() dto: ImportGtfsDto) {
		return this.gtfsService.importFeed(dto);
	}

	@Get('agencies')
	async listAgencies() {
		return this.gtfsService.listAgencies();
	}
}