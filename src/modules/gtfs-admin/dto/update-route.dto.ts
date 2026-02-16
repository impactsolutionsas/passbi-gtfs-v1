import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class UpdateRouteDto {
	@IsOptional()
	@IsString()
	agency_id?: string;

	@IsOptional()
	@IsString()
	route_short_name?: string;

	@IsOptional()
	@IsString()
	route_long_name?: string;

	@IsOptional()
	@IsInt()
	@Min(0)
	route_type?: number;

	@IsOptional()
	@IsString()
	route_color?: string;

	@IsOptional()
	@IsString()
	route_text_color?: string;
}
