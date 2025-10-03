import { IsNumber } from 'class-validator';

export class RouteQueryDto {
	@IsNumber()
	fromLat!: number;

	@IsNumber()
	fromLon!: number;

	@IsNumber()
	toLat!: number;

	@IsNumber()
	toLon!: number;
}
