import { Body, Controller, Post } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { RouteQueryDto } from './dto/route-query.dto';

@Controller()
export class RoutingController {
	constructor(private readonly routing: RoutingService) {}

	@Post('route')
	async route(@Body() dto: RouteQueryDto) {
		return this.routing.route(dto);
	}

	@Post('route/direct')
	async routeDirect(@Body() dto: RouteQueryDto) {
		return this.routing.routeDirect(dto);
	}
}
