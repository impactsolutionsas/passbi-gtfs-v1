import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number = 1;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit?: number = 20;
}

export class AgencyQueryDto extends PaginationDto {
	@IsOptional()
	@IsString()
	search?: string;
}

export class RouteQueryDto extends PaginationDto {
	@IsOptional()
	@IsString()
	agency_id?: string;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	route_type?: number;

	@IsOptional()
	@IsString()
	search?: string;
}

export class StopQueryDto extends PaginationDto {
	@IsOptional()
	@IsString()
	agency_id?: string;

	@IsOptional()
	@IsString()
	search?: string;
}

export class TripQueryDto extends PaginationDto {
	@IsOptional()
	@IsString()
	route_id?: string;

	@IsOptional()
	@IsString()
	service_id?: string;
}
