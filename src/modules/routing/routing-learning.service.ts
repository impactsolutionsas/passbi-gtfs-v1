import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import * as crypto from 'crypto';
import * as ngeohash from 'ngeohash';

@Injectable()
export class RoutingLearningService {
	private readonly logger = new Logger(RoutingLearningService.name);

	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Génère un hash unique pour un itinéraire basé sur ses legs
	 */
	generateRouteHash(legs: any[]): string {
		// Créer une représentation normalisée et plus complète de l'itinéraire
		const routeSignature = legs
			.map((leg) => {
				const mode = leg.mode || 'unknown_mode';
				const routeId = leg.route_id || 'walk';
				const fromStop = leg.from_stop?.stop_id || 'no_from';
				const toStop = leg.to_stop?.stop_id || 'no_to';
				const shape = leg.shape_id || leg.shape?._id || 'no_shape';
				const agency = leg.agency_id || leg.agency || 'no_agency';
				return [mode, routeId, fromStop, toStop, shape, agency].join(':');
			})
			.join('|');

		// Générer un hash SHA-256 complet (hex 64 chars) pour réduire les collisions
		return crypto.createHash('sha256').update(routeSignature).digest('hex');
	}

	/**
	 * Calcule une cellule géographique à partir de coordonnées
	 * Utilise un geohash (precision 7 ~150m) pour des cellules spatiales régulières
	 */
	calculateCell(lat: number, lon: number): string {
		// précision 7 donne une grille adaptée (~150 m); ajuster si nécessaire
		return ngeohash.encode(lat, lon, 7);
	}

	/**
	 * Enregistre ou met à jour les statistiques d'usage d'un itinéraire
	 */
	async recordUsage(
		fromLat: number,
		fromLon: number,
		toLat: number,
		toLon: number,
		routeHash: string,
		routeType: 'direct' | 'simple' | 'fast'
	): Promise<void> {
		const fromCell = this.calculateCell(fromLat, fromLon);
		const toCell = this.calculateCell(toLat, toLon);

		try {
			await this.prisma.$executeRawUnsafe(
				`INSERT INTO route_usage_stats (from_cell, to_cell, route_hash, route_type, hits, last_used_at)
				 VALUES ($1, $2, $3, $4, 1, NOW())
				 ON CONFLICT (from_cell, to_cell, route_hash, route_type)
				 DO UPDATE SET 
				   hits = route_usage_stats.hits + 1,
				   last_used_at = NOW()`,
				fromCell,
				toCell,
				routeHash,
				routeType
			);
		} catch (error) {
			this.logger.error(`Error recording usage stats:`, error);
		}
	}

	/**
	 * Récupère le nombre de hits pour un itinéraire donné
	 */
	async getHits(
		fromLat: number,
		fromLon: number,
		toLat: number,
		toLon: number,
		routeHash: string,
		routeType: 'direct' | 'simple' | 'fast'
	): Promise<number> {
		const fromCell = this.calculateCell(fromLat, fromLon);
		const toCell = this.calculateCell(toLat, toLon);

		try {
			const result = await this.prisma.$queryRawUnsafe(
				`SELECT hits FROM route_usage_stats
				 WHERE from_cell = $1 AND to_cell = $2 AND route_hash = $3 AND route_type = $4`,
				fromCell,
				toCell,
				routeHash,
				routeType
			) as Array<{ hits: number }>;

			return result.length > 0 ? result[0]!.hits : 0;
		} catch (error) {
			this.logger.error(`Error getting hits:`, error);
			return 0;
		}
	}
}

