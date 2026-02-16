import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsDateString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum FareType {
	TICKET = 'ticket',
	CARNET = 'carnet',
	ABONNEMENT_HEBDO = 'abonnement_hebdo',
	ABONNEMENT_MENSUEL = 'abonnement_mensuel',
}

export class CreateFareDto {
	@IsString()
	@IsNotEmpty()
	agency_id!: string;

	@IsOptional()
	@IsString()
	route_id?: string;

	@IsEnum(FareType)
	fare_type!: FareType;

	@IsNumber()
	@Min(0)
	price_cfa!: number;

	@IsOptional()
	@IsString()
	currency?: string;

	@IsOptional()
	@IsString()
	description?: string;

	@IsOptional()
	@IsBoolean()
	is_active?: boolean;

	@IsOptional()
	@IsDateString()
	valid_from?: string;

	@IsOptional()
	@IsDateString()
	valid_until?: string;
}

export class UpdateFareDto {
	@IsOptional()
	@IsString()
	agency_id?: string;

	@IsOptional()
	@IsString()
	route_id?: string;

	@IsOptional()
	@IsEnum(FareType)
	fare_type?: FareType;

	@IsOptional()
	@IsNumber()
	@Min(0)
	price_cfa?: number;

	@IsOptional()
	@IsString()
	currency?: string;

	@IsOptional()
	@IsString()
	description?: string;

	@IsOptional()
	@IsBoolean()
	is_active?: boolean;

	@IsOptional()
	@IsDateString()
	valid_from?: string;

	@IsOptional()
	@IsDateString()
	valid_until?: string;
}

export class FareQueryDto {
	@IsOptional()
	@IsString()
	agency_id?: string;

	@IsOptional()
	@IsString()
	route_id?: string;

	@IsOptional()
	@IsEnum(FareType)
	fare_type?: FareType;

	@IsOptional()
	@IsBoolean()
	is_active?: boolean;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	page?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	limit?: number;
}
