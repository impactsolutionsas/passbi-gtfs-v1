import { IsString, IsOptional, IsEmail } from 'class-validator';

export class UpdateAgencyDto {
	@IsOptional()
	@IsString()
	agency_name?: string;

	@IsOptional()
	@IsString()
	agency_timezone?: string;

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
