import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class CreateRouteDto {
	@IsString()
	@IsNotEmpty()
	route_id!: string;

	@IsString()
	@IsNotEmpty()
	agency_id!: string;

	@IsOptional()
	@IsString()
	route_short_name?: string;

	@IsOptional()
	@IsString()
	route_long_name?: string;

	@IsInt()
	@Min(0)
	route_type!: number;

	@IsOptional()
	@IsString()
	route_color?: string;

	@IsOptional()
	@IsString()
	route_text_color?: string;
}
