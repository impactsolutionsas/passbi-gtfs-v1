import { Controller, Post } from '@nestjs/common';
import { GtfsGraphService } from './gtfs-graph.service';

@Controller('gtfs')
export class GtfsGraphController {
	constructor(private readonly graphService: GtfsGraphService) {}

	@Post('build-graph')
	async buildGraph() {
		return this.graphService.buildGraph();
	}
}
