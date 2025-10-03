import { IsNumber, IsString, IsOptional, IsUrl, Min } from 'class-validator';

export class CreateVtcConfigDto {
	@IsNumber()
	@Min(0)
	base_cost_cfa!: number;

	@IsNumber()
	@Min(0)
	cost_per_km_cfa!: number;

	@IsNumber()
	@Min(0)
	avg_speed_ms!: number;

	@IsString()
	@IsOptional()
	name?: string;

	@IsString()
	@IsOptional()
	@IsUrl()
	logo_url?: string;
}

export class UpdateVtcConfigDto {
	@IsNumber()
	@IsOptional()
	@Min(0)
	base_cost_cfa?: number;

	@IsNumber()
	@IsOptional()
	@Min(0)
	cost_per_km_cfa?: number;

	@IsNumber()
	@IsOptional()
	@Min(0)
	avg_speed_ms?: number;

	@IsString()
	@IsOptional()
	name?: string;

	@IsString()
	@IsOptional()
	@IsUrl()
	logo_url?: string;
}
