export interface RouteStep {
	mode: string;
	agency_id: string | null;
	route_id: string | null;
	route_short_name: string | null;
	route_long_name: string | null;
	from_stop: {
		stop_id: string;
		stop_name: string;
		stop_lat: number;
		stop_lon: number;
	};
	to_stop: {
		stop_id: string;
		stop_name: string;
		stop_lat: number;
		stop_lon: number;
	};
}

export interface RouteVariant {
	type: 'direct' | 'simple' | 'fast';
	score: number;
	duration_est_min: number;
	steps: RouteStep[];
}

export interface RouteResponse {
	from: { lat: number; lon: number };
	to: { lat: number; lon: number };
	routes: RouteVariant[];
	cached: boolean;
}

