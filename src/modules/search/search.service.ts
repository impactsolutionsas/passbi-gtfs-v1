import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface SearchPlaceResult {
	id: string;
	label: string;
	type: 'stop' | 'route' | 'agency' | 'poi';
	lat: number | null;
	lon: number | null;
	rank: number;
}

@Injectable()
export class SearchService {
	private readonly logger = new Logger(SearchService.name);

	constructor(private readonly prisma: PrismaService) {}

	async searchPlaces(query: string, limit: number = 10): Promise<SearchPlaceResult[]> {
		this.logger.log(`Searching places with query: "${query}", limit: ${limit}`);

		if (!query || query.trim().length < 2) {
			this.logger.warn('Query too short, returning empty results');
			return [];
		}

		try {
			const results = await this.prisma.$queryRawUnsafe<SearchPlaceResult[]>(
				`SELECT * FROM search_places($1, $2::int)`,
				query.trim(),
				limit
			);

			this.logger.log(`Found ${results.length} results for query: "${query}"`);
			return results;
		} catch (error) {
			this.logger.error(`Error searching places: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
			throw error;
		}
	}
}

