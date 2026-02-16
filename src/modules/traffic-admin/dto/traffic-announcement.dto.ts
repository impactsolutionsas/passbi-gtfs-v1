import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, IsDateString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum AnnouncementType {
	PERTURBATION = 'perturbation',
	TRAVAUX = 'travaux',
	RETARD = 'retard',
	INFO = 'info',
}

export class CreateTrafficAnnouncementDto {
	@IsString()
	@IsNotEmpty()
	title!: string;

	@IsString()
	@IsNotEmpty()
	description!: string;

	@IsEnum(AnnouncementType)
	announcement_type!: AnnouncementType;

	@IsOptional()
	@IsString()
	agency_id?: string;

	@IsOptional()
	@IsString()
	image_url?: string;

	@IsDateString()
	start_date!: string;

	@IsOptional()
	@IsDateString()
	end_date?: string;

	@IsOptional()
	@IsBoolean()
	is_active?: boolean;

	@IsOptional()
	@IsInt()
	priority?: number;
}

export class UpdateTrafficAnnouncementDto {
	@IsOptional()
	@IsString()
	title?: string;

	@IsOptional()
	@IsString()
	description?: string;

	@IsOptional()
	@IsEnum(AnnouncementType)
	announcement_type?: AnnouncementType;

	@IsOptional()
	@IsString()
	agency_id?: string;

	@IsOptional()
	@IsString()
	image_url?: string;

	@IsOptional()
	@IsDateString()
	start_date?: string;

	@IsOptional()
	@IsDateString()
	end_date?: string;

	@IsOptional()
	@IsBoolean()
	is_active?: boolean;

	@IsOptional()
	@IsInt()
	priority?: number;
}

export class TrafficAnnouncementQueryDto {
	@IsOptional()
	@IsString()
	agency_id?: string;

	@IsOptional()
	@IsEnum(AnnouncementType)
	announcement_type?: AnnouncementType;

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
