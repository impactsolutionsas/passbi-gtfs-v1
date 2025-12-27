import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { SearchService, SearchPlaceResult } from './search.service';

@Controller('search')
export class SearchController {
	constructor(private readonly searchService: SearchService) {}

	@Get('places')
	async searchPlaces(
		@Query('q') query: string,
		@Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number
	): Promise<SearchPlaceResult[]> {
		return this.searchService.searchPlaces(query, limit);
	}
}

