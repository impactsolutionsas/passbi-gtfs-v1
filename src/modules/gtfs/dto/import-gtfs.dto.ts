import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class ImportGtfsDto {
	@IsString()
	@IsNotEmpty()
	dirPath!: string;

	@IsString()
	@IsNotEmpty()
	agencyId!: string;

	@IsOptional()
	@IsArray()
	skipFiles?: string[];
}
