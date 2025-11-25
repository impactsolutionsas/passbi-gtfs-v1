import { Body, Controller, Post } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { RouteQueryDto } from './dto/route-query.dto';

@Controller()
export class RoutingController {
	constructor(private readonly routing: RoutingService) {}

	@Post('route')
	async route(@Body() dto: RouteQueryDto) {
		console.log(dto);
		const result = await this.routing.route(dto);
		console.log(result);
		return result;
	}

	@Post('route/direct')
	async routeDirect(@Body() dto: RouteQueryDto) {
		return this.routing.routeDirect(dto);
	}
}
