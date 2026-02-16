import { Injectable, Logger } from '@nestjs/common';
import { RoutingLearningService } from './routing-learning.service';

interface RouteLeg {
	mode: string;
	route_id: string | null;
	agency_id: string | null;
	from_stop: { stop_lat: number; stop_lon: number };
	to_stop: { stop_lat: number; stop_lon: number };
}

interface ScoredRoute {
	type: 'direct' | 'simple' | 'fast';
	score: number;
	legs: RouteLeg[];
	duration_est_min: number;
	distance_walk_m: number;
	transfers: number;
	agencies: Set<string>;
}

@Injectable()
export class RoutingScoringService {
	private readonly logger = new Logger(RoutingScoringService.name);

	private readonly WEIGHTS = {
		transfer: 15,
		walkPerMeter: 0.02,
		agencyChange: 8,
		durationPerMin: 0.5,
	};

	constructor(private readonly learningService: RoutingLearningService) {}

	/**
	 * Calcule la distance de marche totale en mètres
	 */
	private calculateWalkDistance(legs: RouteLeg[]): number {
		let totalWalk = 0;
		for (const leg of legs) {
			if (leg.mode === 'walk' || !leg.route_id) {
				const lat1 = leg.from_stop.stop_lat;
				const lon1 = leg.from_stop.stop_lon;
				const lat2 = leg.to_stop.stop_lat;
				const lon2 = leg.to_stop.stop_lon;
				// Distance Haversine approximative
				const R = 6371000; // Rayon de la Terre en mètres
				const dLat = ((lat2 - lat1) * Math.PI) / 180;
				const dLon = ((lon2 - lon1) * Math.PI) / 180;
				const a =
					Math.sin(dLat / 2) * Math.sin(dLat / 2) +
					Math.cos((lat1 * Math.PI) / 180) *
						Math.cos((lat2 * Math.PI) / 180) *
						Math.sin(dLon / 2) *
						Math.sin(dLon / 2);
				const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
				totalWalk += R * c;
			}
		}
		return totalWalk;
	}

	/**
	 * Compte le nombre de correspondances (changements de route)
	 */
	private countTransfers(legs: RouteLeg[]): number {
		if (legs.length <= 1) return 0;
		let transfers = 0;
		for (let i = 1; i < legs.length; i++) {
			const prevLeg = legs[i - 1]!;
			const currLeg = legs[i]!;
			// Une correspondance si changement de route_id ou passage par marche
			if (
				(prevLeg.route_id && currLeg.route_id && prevLeg.route_id !== currLeg.route_id) ||
				(!prevLeg.route_id && currLeg.route_id) ||
				(prevLeg.route_id && !currLeg.route_id)
			) {
				transfers++;
			}
		}
		return transfers;
	}

	/**
	 * Extrait les agences uniques d'un itinéraire
	 */
	private extractAgencies(legs: RouteLeg[]): Set<string> {
		const agencies = new Set<string>();
		for (const leg of legs) {
			if (leg.agency_id) {
				agencies.add(leg.agency_id);
			}
		}
		return agencies;
	}

	/**
	 * Calcule le score de base selon les heuristiques optimisées
	 */
	private calculateBaseScore(
		transfers: number,
		walkDistanceM: number,
		agenciesCount: number,
		durationMin: number = 0
	): number {
		return (
			transfers * this.WEIGHTS.transfer +
			walkDistanceM * this.WEIGHTS.walkPerMeter +
			agenciesCount * this.WEIGHTS.agencyChange +
			durationMin * this.WEIGHTS.durationPerMin
		);
	}

	/**
	 * Vérifie si un itinéraire respecte les contraintes
	 */
	private validateConstraints(
		legs: RouteLeg[],
		walkDistanceM: number,
		agenciesCount: number
	): { valid: boolean; reason?: string } {
		// Max 3 agences (assoupli de 2-3 à 3)
		if (agenciesCount > 3) {
			return { valid: false, reason: 'Too many agencies' };
		}

		// Calculer la distance totale pour vérifier le % de marche
		let totalDistance = 0;
		for (const leg of legs) {
			const lat1 = leg.from_stop.stop_lat;
			const lon1 = leg.from_stop.stop_lon;
			const lat2 = leg.to_stop.stop_lat;
			const lon2 = leg.to_stop.stop_lon;
			const R = 6371000;
			const dLat = ((lat2 - lat1) * Math.PI) / 180;
			const dLon = ((lon2 - lon1) * Math.PI) / 180;
			const a =
				Math.sin(dLat / 2) * Math.sin(dLat / 2) +
				Math.cos((lat1 * Math.PI) / 180) *
					Math.cos((lat2 * Math.PI) / 180) *
					Math.sin(dLon / 2) *
					Math.sin(dLon / 2);
			const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
			totalDistance += R * c;
		}

		// Max 40% du trajet à pied (assoupli : accepter jusqu'à 50% si c'est le seul chemin)
		if (totalDistance > 0 && walkDistanceM / totalDistance > 0.5) {
			return { valid: false, reason: 'Too much walking (>50%)' };
		}

		// Rejet des chemins trop longs (plus de 100km au lieu de 50km pour être plus permissif)
		if (totalDistance > 100000) {
			return { valid: false, reason: 'Path too long (>100km)' };
		}

		return { valid: true };
	}

	/**
	 * Classifie un itinéraire selon son type
	 */
	classifyRoute(legs: RouteLeg[]): 'direct' | 'simple' | 'fast' {
		const transfers = this.countTransfers(legs);
		const routeIds = new Set(legs.filter((l) => l.route_id).map((l) => l.route_id!));
		const agencies = this.extractAgencies(legs);

		// DIRECT : même route_id, 0 correspondance
		if (transfers === 0 && routeIds.size === 1) {
			return 'direct';
		}

		// SIMPLE : ≤ 1 correspondance, moins de marche, même agency si possible
		if (transfers <= 1) {
			return 'simple';
		}

		// RAPIDE : plusieurs correspondances acceptées
		return 'fast';
	}

	/**
	 * Calcule le score final d'un itinéraire avec ajustement IA
	 */
	async calculateScore(
		legs: RouteLeg[],
		fromLat: number,
		fromLon: number,
		toLat: number,
		toLon: number
	): Promise<{ score: number; valid: boolean; reason?: string; type: 'direct' | 'simple' | 'fast' }> {
		const transfers = this.countTransfers(legs);
		const walkDistanceM = this.calculateWalkDistance(legs);
		const agencies = this.extractAgencies(legs);
		const agenciesCount = agencies.size;
		const durationMin = this.estimateDuration(legs);

		const validation = this.validateConstraints(legs, walkDistanceM, agenciesCount);
		if (!validation.valid) {
			return {
				score: Infinity,
				valid: false,
				reason: validation.reason,
				type: this.classifyRoute(legs),
			};
		}

		const baseScore = this.calculateBaseScore(transfers, walkDistanceM, agenciesCount, durationMin);

		const routeType = this.classifyRoute(legs);
		const routeHash = this.learningService.generateRouteHash(legs);
		const hits = await this.learningService.getHits(fromLat, fromLon, toLat, toLon, routeHash, routeType);

		const learningAdjustment = Math.log(hits + 1) * 5;
		const finalScore = baseScore - learningAdjustment;

		return {
			score: Math.max(0, finalScore),
			valid: true,
			type: routeType,
		};
	}

	/**
	 * Estime la durée totale en minutes
	 */
	estimateDuration(legs: RouteLeg[]): number {
		// Estimation basique : 2 minutes par leg + temps de marche
		let duration = legs.length * 2;
		const walkDistanceM = this.calculateWalkDistance(legs);
		// Vitesse de marche : 1.25 m/s = 75 m/min
		duration += walkDistanceM / 75;
		return Math.round(duration);
	}
}

