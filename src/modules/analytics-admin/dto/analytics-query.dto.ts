import { IsOptional, IsDateString, IsString, IsEnum } from 'class-validator';

export enum TimeRange {
	DAY = 'day',
	WEEK = 'week',
	MONTH = 'month',
	YEAR = 'year',
}

export class AnalyticsQueryDto {
	@IsOptional()
	@IsDateString()
	start_date?: string;

	@IsOptional()
	@IsDateString()
	end_date?: string;

	@IsOptional()
	@IsEnum(TimeRange)
	time_range?: TimeRange;
}

export class ExportQueryDto extends AnalyticsQueryDto {
	@IsOptional()
	@IsString()
	format?: 'csv' | 'json';
}
