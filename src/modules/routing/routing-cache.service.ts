import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class RoutingCacheService {
	private readonly logger = new Logger(RoutingCacheService.name);
	private readonly DEFAULT_TTL_MINUTES = 10; // TTL par défaut : 10 minutes

	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Génère une clé de cache à partir des coordonnées
	 * Arrondi à 4 décimales (~11 m de précision)
	 */
	generateCacheKey(fromLat: number, fromLon: number, toLat: number, toLon: number): string {
		const roundedFromLat = Number(fromLat.toFixed(4));
		const roundedFromLon = Number(fromLon.toFixed(4));
		const roundedToLat = Number(toLat.toFixed(4));
		const roundedToLon = Number(toLon.toFixed(4));
		return `route:${roundedFromLat}:${roundedFromLon}:${roundedToLat}:${roundedToLon}`;
	}

	/**
	 * Récupère une entrée du cache si elle existe et n'est pas expirée
	 */
	async get(cacheKey: string): Promise<any | null> {
		try {
			const result = await this.prisma.$queryRawUnsafe(
				`SELECT response FROM route_cache 
				 WHERE cache_key = $1 AND expires_at > NOW()`,
				cacheKey
			) as Array<{ response: any }>;

			if (result.length > 0) {
				this.logger.debug(`Cache hit: ${cacheKey}`);
				return result[0]!.response;
			}

			this.logger.debug(`Cache miss: ${cacheKey}`);
			return null;
		} catch (error) {
			this.logger.error(`Error getting cache for key ${cacheKey}:`, error);
			return null;
		}
	}

	/**
	 * Stocke une entrée dans le cache avec TTL
	 */
	async set(cacheKey: string, response: any, ttlMinutes?: number): Promise<void> {
		const ttl = ttlMinutes || this.DEFAULT_TTL_MINUTES;
		const expiresAt = new Date(Date.now() + ttl * 60 * 1000);

		try {
			// Caster explicitement en JSONB pour PostgreSQL
			await this.prisma.$executeRawUnsafe(
				`INSERT INTO route_cache (cache_key, response, expires_at)
				 VALUES ($1, $2::jsonb, $3)
				 ON CONFLICT (cache_key) 
				 DO UPDATE SET response = $2::jsonb, expires_at = $3, created_at = NOW()`,
				cacheKey,
				JSON.stringify(response),
				expiresAt
			);
			this.logger.debug(`Cache set: ${cacheKey} (expires in ${ttl} minutes)`);
		} catch (error) {
			this.logger.error(`Error setting cache for key ${cacheKey}:`, error);
		}
	}

	/**
	 * Supprime une entrée du cache
	 */
	async delete(cacheKey: string): Promise<void> {
		try {
			await this.prisma.$executeRawUnsafe(
				`DELETE FROM route_cache WHERE cache_key = $1`,
				cacheKey
			);
		} catch (error) {
			this.logger.error(`Error deleting cache for key ${cacheKey}:`, error);
		}
	}

	/**
	 * Nettoie les entrées expirées du cache
	 */
	async cleanupExpired(): Promise<number> {
		try {
			const result = await this.prisma.$executeRawUnsafe(
				`DELETE FROM route_cache WHERE expires_at <= NOW()`
			);
			this.logger.debug(`Cleaned up expired cache entries`);
			return Number(result);
		} catch (error) {
			this.logger.error(`Error cleaning up expired cache:`, error);
			return 0;
		}
	}
}

