import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateVtcConfigDto, UpdateVtcConfigDto } from './dto/vtc-config.dto';

export interface VtcFareResult {
	mode: 'vtc';
	agency_id: string;
	name: string;
	logo_url?: string;
	cost_cfa: number;
	est_duration_s: number;
	from_stop: {
		lat: number;
		lon: number;
	};
	to_stop: {
		lat: number;
		lon: number;
	};
}

@Injectable()
export class VtcService {
	private readonly logger = new Logger(VtcService.name);

	constructor(private readonly prisma: PrismaService) {}

	async getAllConfigs() {
		return this.prisma.vtc_config.findMany({
			orderBy: { id: 'asc' }
		});
	}

	async createConfig(dto: CreateVtcConfigDto) {
		return this.prisma.vtc_config.create({
			data: dto
		});
	}

	async updateConfig(id: number, dto: UpdateVtcConfigDto) {
		const existing = await this.prisma.vtc_config.findUnique({
			where: { id }
		});
		if (!existing) {
			throw new NotFoundException(`VTC config with ID ${id} not found`);
		}

		return this.prisma.vtc_config.update({
			where: { id },
			data: dto
		});
	}

	async deleteConfig(id: number) {
		const existing = await this.prisma.vtc_config.findUnique({
			where: { id }
		});
		if (!existing) {
			throw new NotFoundException(`VTC config with ID ${id} not found`);
		}

		return this.prisma.vtc_config.delete({
			where: { id }
		});
	}

	/**
	 * Calcule le prix et la durée d'un trajet VTC
	 */
	async computeFare(
		fromLat: number, 
		fromLon: number, 
		toLat: number, 
		toLon: number, 
		vtcId?: number
	): Promise<VtcFareResult[]> {
		// Récupérer les configs VTC (toutes ou une spécifique)
		const configs = vtcId 
			? await this.prisma.vtc_config.findMany({ where: { id: vtcId } })
			: await this.prisma.vtc_config.findMany();

		if (configs.length === 0) {
			// Config par défaut si aucune config trouvée
			configs.push({
				id: 0,
				base_cost_cfa: 1000,
				cost_per_km_cfa: 100,
				avg_speed_ms: 7.0,
				name: 'VTC Default',
				logo_url: null
			} as any);
		}

		const results: VtcFareResult[] = [];

		for (const config of configs) {
			// Calculer la distance en mètres avec PostGIS
			const distanceResult = await this.prisma.$queryRawUnsafe<any[]>(`
				SELECT ST_DistanceSphere(
					ST_SetSRID(ST_MakePoint($1, $2), 4326),
					ST_SetSRID(ST_MakePoint($3, $4), 4326)
				) as distance_m
			`, fromLon, fromLat, toLon, toLat);

			const distanceM = Number(distanceResult[0]?.distance_m || 0);
			const distanceKm = distanceM / 1000;

			// Calculer le prix avec valeurs par défaut
			const baseCost = config.base_cost_cfa || 1000;
			const costPerKm = config.cost_per_km_cfa || 500;
			const costCfa = Math.round(baseCost + (distanceKm * costPerKm));

			// Calculer la durée estimée en secondes
			const avgSpeed = Number(config.avg_speed_ms || 7.0);
			const estDurationS = Math.round(distanceM / avgSpeed);

			results.push({
				mode: 'vtc',
				agency_id: (config as any).id || 'VTC',
				name: config.name ?? 'VTC',
				logo_url: config.logo_url ?? undefined,
				cost_cfa: costCfa,
				est_duration_s: estDurationS,
				from_stop: {
					lat: fromLat,
					lon: fromLon
				},
				to_stop: {
					lat: toLat,
					lon: toLon
				}
			});
		}

		// Trier les résultats du moins cher au plus cher
		return results.sort((a, b) => a.cost_cfa - b.cost_cfa);
	}

	/**
	 * Calcule la distance entre deux points géographiques (Haversine)
	 * Alternative au calcul PostGIS pour les cas où PostGIS n'est pas disponible
	 */
	private calculateDistanceHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
		const R = 6371000; // Rayon de la Terre en mètres
		const dLat = this.toRadians(lat2 - lat1);
		const dLon = this.toRadians(lon2 - lon1);
		const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
			Math.sin(dLon / 2) * Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return R * c;
	}

	private toRadians(degrees: number): number {
		return degrees * (Math.PI / 180);
	}
}
