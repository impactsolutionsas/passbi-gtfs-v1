import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class UpdateStopDto {
	@IsOptional()
	@IsString()
	agency_id?: string;

	@IsOptional()
	@IsString()
	stop_code?: string;

	@IsOptional()
	@IsString()
	stop_name?: string;

	@IsOptional()
	@IsString()
	stop_desc?: string;

	@IsOptional()
	@IsNumber()
	@Min(-90)
	@Max(90)
	stop_lat?: number;

	@IsOptional()
	@IsNumber()
	@Min(-180)
	@Max(180)
	stop_lon?: number;

	@IsOptional()
	@IsNumber()
	location_type?: number;

	@IsOptional()
	@IsString()
	parent_station?: string;

	@IsOptional()
	@IsString()
	zone_id?: string;
}
