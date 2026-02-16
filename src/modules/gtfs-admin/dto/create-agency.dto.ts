import { IsString, IsNotEmpty, IsOptional, IsEmail } from 'class-validator';

export class CreateAgencyDto {
	@IsString()
	@IsNotEmpty()
	agency_id!: string;

	@IsString()
	@IsNotEmpty()
	agency_name!: string;

	@IsString()
	@IsNotEmpty()
	agency_timezone!: string;

	@IsOptional()
	@IsString()
	agency_url?: string;

	@IsOptional()
	@IsString()
	agency_lang?: string;

	@IsOptional()
	@IsString()
	agency_phone?: string;

	@IsOptional()
	@IsEmail()
	agency_email?: string;
}
