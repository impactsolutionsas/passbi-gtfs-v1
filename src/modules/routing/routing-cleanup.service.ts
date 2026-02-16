import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class RoutingCleanupService {
	private readonly logger = new Logger(RoutingCleanupService.name);

	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Nettoie les entrées expirées du cache et des locks
	 * Exécuté toutes les heures
	 */
	@Cron(CronExpression.EVERY_HOUR)
	async handleCleanup(): Promise<void> {
		this.logger.log('Starting cleanup of expired cache entries and locks');

		try {
			// Nettoyer route_cache
			const cacheResult = await this.prisma.$executeRawUnsafe(
				`DELETE FROM route_cache WHERE expires_at <= NOW()`
			);
			this.logger.log(`Cleaned up ${Number(cacheResult)} expired cache entries`);

			// Nettoyer route_locks
			const locksResult = await this.prisma.$executeRawUnsafe(
				`DELETE FROM route_locks WHERE expires_at <= NOW()`
			);
			this.logger.log(`Cleaned up ${Number(locksResult)} expired locks`);

			// Optionnel : nettoyer les stats anciennes (plus de 90 jours)
			const statsResult = await this.prisma.$executeRawUnsafe(
				`DELETE FROM route_usage_stats WHERE last_used_at < NOW() - INTERVAL '90 days'`
			);
			this.logger.log(`Cleaned up ${Number(statsResult)} old usage stats`);
		} catch (error) {
			this.logger.error('Error during cleanup:', error);
		}
	}
}

