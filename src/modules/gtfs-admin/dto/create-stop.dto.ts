import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class CreateStopDto {
	@IsString()
	@IsNotEmpty()
	stop_id!: string;

	@IsString()
	@IsNotEmpty()
	agency_id!: string;

	@IsOptional()
	@IsString()
	stop_code?: string;

	@IsString()
	@IsNotEmpty()
	stop_name!: string;

	@IsOptional()
	@IsString()
	stop_desc?: string;

	@IsNumber()
	@Min(-90)
	@Max(90)
	stop_lat!: number;

	@IsNumber()
	@Min(-180)
	@Max(180)
	stop_lon!: number;

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
