import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ImportGtfsDto } from './dto/import-gtfs.dto';
import * as fs from 'fs';
import * as path from 'path';
import { parseCsv } from './utils/parse-csv';

@Injectable()
export class GtfsService {
	private readonly logger = new Logger(GtfsService.name);

	constructor(private readonly prisma: PrismaService) {}

	async listAgencies() {
		const agencies = await this.prisma.$queryRawUnsafe(
			'SELECT agency_id, agency_name FROM agency ORDER BY agency_id'
		) as Array<{ agency_id: string; agency_name: string }>;
		return agencies;
	}

	async importFeed(dto: ImportGtfsDto) {
		this.logger.log(`Starting GTFS import for agencyId=${dto.agencyId} dir=${dto.dirPath}`);
		const dir = path.resolve(dto.dirPath);
		if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
			throw new Error(`Directory not found: ${dir}`);
		}

		const expectedFiles = [
			'agency.txt',
			'stops.txt',
			'routes.txt',
			'trips.txt',
			'stop_times.txt',
			'calendar.txt',
			'calendar_dates.txt',
			'shapes.txt',
			'fare_attributes.txt',
			'fare_rules.txt',
		];

		const skipSet = new Set((dto.skipFiles ?? []).map(f => f.toLowerCase()));
		if (skipSet.size > 0) {
			this.logger.log(`Skipping files: ${Array.from(skipSet).join(', ')}`);
		}

		const filesProcessed: string[] = [];

		// Ensure base agency exists
		await this.prisma.$executeRawUnsafe(
			"INSERT INTO agency(agency_id, agency_name, agency_timezone) VALUES($1, $2, $3) ON CONFLICT (agency_id) DO NOTHING",
			dto.agencyId,
			dto.agencyId,
			'UTC'
		);
		this.logger.log(`Upserted base agency row for ${dto.agencyId}`);

		for (const file of expectedFiles) {
			if (skipSet.has(file.toLowerCase())) {
				this.logger.log(`${file} explicitly skipped.`);
				continue;
			}
			const filePath = path.join(dir, file);
			if (!fs.existsSync(filePath)) {
				this.logger.log(`${file} not found, skipping.`);
				continue;
			}

			this.logger.log(`Parsing ${file} ...`);
			const rows = await parseCsv(filePath);
			this.logger.log(`${file} parsed: ${rows.length} rows`);
			if (rows.length === 0) continue;

			switch (file) {
				case 'agency.txt':
					await this.importAgencyBatched(rows, dto.agencyId);
					break;
				case 'stops.txt':
					await this.importStopsBatched(rows, dto.agencyId);
					break;
				case 'routes.txt':
					await this.importRoutesBatched(rows, dto.agencyId);
					break;
				case 'trips.txt':
					await this.importTripsBatched(rows);
					break;
				case 'stop_times.txt':
					await this.importStopTimesBatched(rows);
					break;
				case 'calendar.txt':
					await this.importCalendarBatched(rows);
					break;
				case 'calendar_dates.txt':
					await this.importCalendarDatesBatched(rows);
					break;
				case 'shapes.txt':
					await this.importShapesBatched(rows);
					break;
				case 'fare_attributes.txt':
					await this.importFareAttributesBatched(rows, dto.agencyId);
					break;
				case 'fare_rules.txt':
					await this.importFareRulesBatched(rows);
					break;
			}

			filesProcessed.push(file);
			this.logger.log(`${file}: import finished.`);
		}

		this.logger.log(`GTFS import completed for agencyId=${dto.agencyId}`);
		return { status: 'ok', agencyId: dto.agencyId, filesProcessed };
	}

	private hhmmToSeconds(value?: string | null): number | null {
		if (!value) return null;
		const parts = value.split(':');
		if (parts.length < 2) return null;
		const h = Number(parts[0] ?? 0);
		const m = Number(parts[1] ?? 0);
		const s = Number(parts[2] ?? 0);
		return h * 3600 + m * 60 + s;
	}

	private chunkArray<T>(items: T[], chunkSize: number): T[][] {
		const chunks: T[][] = [];
		for (let i = 0; i < items.length; i += chunkSize) {
			chunks.push(items.slice(i, i + chunkSize));
		}
		return chunks;
	}

	private async importAgencyBatched(rows: Record<string, string>[], fallbackAgencyId: string) {
		const CHUNK = 1000;
		this.logger.log(`Importing agency.txt in chunks of ${CHUNK}`);
		let chunkIndex = 0;
		for (const chunk of this.chunkArray(rows, CHUNK)) {
			chunkIndex++;
			const agencyIds: string[] = [];
			const names: (string | null)[] = [];
			const urls: (string | null)[] = [];
			const timezones: (string | null)[] = [];
			const langs: (string | null)[] = [];
			const phones: (string | null)[] = [];
			const emails: (string | null)[] = [];

			for (const r of chunk) {
				agencyIds.push(r['agency_id'] || fallbackAgencyId);
				names.push(r['agency_name'] ?? fallbackAgencyId);
				urls.push(r['agency_url'] ?? null);
				timezones.push(r['agency_timezone'] ?? 'UTC');
				langs.push(r['agency_lang'] ?? null);
				phones.push(r['agency_phone'] ?? null);
				emails.push(r['agency_email'] ?? null);
			}

			await this.prisma.$executeRawUnsafe(
				`INSERT INTO agency(agency_id, agency_name, agency_url, agency_timezone, agency_lang, agency_phone, agency_email)
				SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[])
				ON CONFLICT (agency_id) DO NOTHING`,
				agencyIds, names, urls, timezones, langs, phones, emails,
			);
			this.logger.log(`agency.txt chunk ${chunkIndex}: inserted ${chunk.length}`);
		}
	}

	private async importStopsBatched(rows: Record<string, string>[], agencyId: string) {
		const CHUNK = 5000;
		this.logger.log(`Importing stops.txt in chunks of ${CHUNK}`);
		let i = 0;
		for (const chunk of this.chunkArray(rows, CHUNK)) {
			i++;
			const stopIds: (string | null)[] = [];
			const agencyIds: (string | null)[] = [];
			const codes: (string | null)[] = [];
			const names: (string | null)[] = [];
			const descs: (string | null)[] = [];
			const lats: (number | null)[] = [];
			const lons: (number | null)[] = [];
			const locTypes: number[] = [];
			const parents: (string | null)[] = [];
			const zones: (string | null)[] = [];
			for (const r of chunk) {
				stopIds.push(r['stop_id'] ?? null);
				agencyIds.push(agencyId);
				codes.push(r['stop_code'] ?? null);
				names.push(r['stop_name'] ?? null);
				descs.push(r['stop_desc'] ?? null);
				lats.push(r['stop_lat'] ? Number(r['stop_lat']) : null);
				lons.push(r['stop_lon'] ? Number(r['stop_lon']) : null);
				locTypes.push(r['location_type'] ? Number(r['location_type']) : 0);
				parents.push(r['parent_station'] ?? null);
				zones.push(r['zone_id'] ?? null);
			}
			await this.prisma.$executeRawUnsafe(
				`INSERT INTO stops(stop_id, agency_id, stop_code, stop_name, stop_desc, stop_lat, stop_lon, location_type, parent_station, zone_id)
				SELECT * FROM unnest(
					$1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::float8[], $7::float8[], $8::int[], $9::text[], $10::text[]
				)
				ON CONFLICT (stop_id) DO NOTHING`,
				stopIds, agencyIds, codes, names, descs, lats, lons, locTypes, parents, zones,
			);
			this.logger.log(`stops.txt chunk ${i}: inserted ${chunk.length}`);
		}
	}

	private async importRoutesBatched(rows: Record<string, string>[], agencyId: string) {
		const CHUNK = 5000;
		this.logger.log(`Importing routes.txt in chunks of ${CHUNK}`);
		let i = 0;
		for (const chunk of this.chunkArray(rows, CHUNK)) {
			i++;
			const routeIds: (string | null)[] = [];
			const agencyIds: (string | null)[] = [];
			const shortNames: (string | null)[] = [];
			const longNames: (string | null)[] = [];
			const types: number[] = [];
			const colors: (string | null)[] = [];
			const textColors: (string | null)[] = [];
			for (const r of chunk) {
				routeIds.push(r['route_id'] ?? null);
				agencyIds.push(agencyId);
				shortNames.push(r['route_short_name'] ?? null);
				longNames.push(r['route_long_name'] ?? null);
				types.push(r['route_type'] ? Number(r['route_type']) : 3);
				colors.push(r['route_color'] ?? null);
				textColors.push(r['route_text_color'] ?? null);
			}
			await this.prisma.$executeRawUnsafe(
				`INSERT INTO routes(route_id, agency_id, route_short_name, route_long_name, route_type, route_color, route_text_color)
				SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::int[], $6::text[], $7::text[])
				ON CONFLICT (route_id) DO NOTHING`,
				routeIds, agencyIds, shortNames, longNames, types, colors, textColors,
			);
			this.logger.log(`routes.txt chunk ${i}: inserted ${chunk.length}`);
		}
	}

	private async importTripsBatched(rows: Record<string, string>[]) {
		const CHUNK = 5000;
		this.logger.log(`Importing trips.txt in chunks of ${CHUNK}`);
		let i = 0;
		for (const chunk of this.chunkArray(rows, CHUNK)) {
			i++;
			const tripIds: (string | null)[] = [];
			const routeIds: (string | null)[] = [];
			const serviceIds: (string | null)[] = [];
			const heads: (string | null)[] = [];
			const directions: (number | null)[] = [];
			const shapeIds: (string | null)[] = [];
			for (const r of chunk) {
				tripIds.push(r['trip_id'] ?? null);
				routeIds.push(r['route_id'] ?? null);
				serviceIds.push(r['service_id'] ?? null);
				heads.push(r['trip_headsign'] ?? null);
				directions.push(r['direction_id'] ? Number(r['direction_id']) : null);
				shapeIds.push(r['shape_id'] ?? null);
			}
			await this.prisma.$executeRawUnsafe(
				`INSERT INTO trips(trip_id, route_id, service_id, trip_headsign, direction_id, shape_id)
				SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::int[], $6::text[])
				ON CONFLICT (trip_id) DO NOTHING`,
				tripIds, routeIds, serviceIds, heads, directions, shapeIds,
			);
			this.logger.log(`trips.txt chunk ${i}: inserted ${chunk.length}`);
		}
	}

	private async importStopTimesBatched(rows: Record<string, string>[]) {
		const CHUNK = 2000;
		this.logger.log(`Importing stop_times.txt in chunks of ${CHUNK}`);
		let i = 0;
		for (const chunk of this.chunkArray(rows, CHUNK)) {
			i++;
			const tripIds: (string | null)[] = [];
			const arrSecs: (number | null)[] = [];
			const depSecs: (number | null)[] = [];
			const stopIds: (string | null)[] = [];
			const stopSeqs: number[] = [];
			const pickupTypes: (number | null)[] = [];
			const dropoffTypes: (number | null)[] = [];
			const timepoints: (number | null)[] = [];

			for (const r of chunk) {
				tripIds.push(r['trip_id'] ?? null);
				arrSecs.push(this.hhmmToSeconds(r['arrival_time']));
				depSecs.push(this.hhmmToSeconds(r['departure_time']));
				stopIds.push(r['stop_id'] ?? null);
				stopSeqs.push(r['stop_sequence'] ? Number(r['stop_sequence']) : 0);
				pickupTypes.push(r['pickup_type'] ? Number(r['pickup_type']) : 0);
				dropoffTypes.push(r['drop_off_type'] ? Number(r['drop_off_type']) : 0);
				timepoints.push(r['timepoint'] ? Number(r['timepoint']) : null);
			}

			await this.prisma.$executeRawUnsafe(
				`INSERT INTO stop_times(
					trip_id, arrival_time, departure_time, stop_id, stop_sequence, pickup_type, drop_off_type, timepoint
				)
				SELECT 
					trip_id,
					CASE WHEN arrival_s IS NULL THEN NULL ELSE make_interval(secs := arrival_s) END,
					CASE WHEN departure_s IS NULL THEN NULL ELSE make_interval(secs := departure_s) END,
					stop_id,
					stop_sequence,
					pickup_type,
					drop_off_type,
					timepoint
				FROM unnest(
					$1::text[],
					$2::int[],
					$3::int[],
					$4::text[],
					$5::int[],
					$6::int[],
					$7::int[],
					$8::int[]
				) AS t(trip_id, arrival_s, departure_s, stop_id, stop_sequence, pickup_type, drop_off_type, timepoint)
				ON CONFLICT (trip_id, stop_sequence) DO NOTHING`,
				tripIds, arrSecs, depSecs, stopIds, stopSeqs, pickupTypes, dropoffTypes, timepoints,
			);
			this.logger.log(`stop_times.txt chunk ${i}: inserted ${chunk.length}`);
		}
	}

	private async importCalendarBatched(rows: Record<string, string>[]) {
		const CHUNK = 2000;
		this.logger.log(`Importing calendar.txt in chunks of ${CHUNK}`);
		let i = 0;
		for (const chunk of this.chunkArray(rows, CHUNK)) {
			i++;
			const serviceIds: (string | null)[] = [];
			const monday: number[] = [];
			const tuesday: number[] = [];
			const wednesday: number[] = [];
			const thursday: number[] = [];
			const friday: number[] = [];
			const saturday: number[] = [];
			const sunday: number[] = [];
			const startDates: (string | null)[] = [];
			const endDates: (string | null)[] = [];
			for (const r of chunk) {
				serviceIds.push(r['service_id'] ?? null);
				monday.push(Number(r['monday'] ?? 0));
				tuesday.push(Number(r['tuesday'] ?? 0));
				wednesday.push(Number(r['wednesday'] ?? 0));
				thursday.push(Number(r['thursday'] ?? 0));
				friday.push(Number(r['friday'] ?? 0));
				saturday.push(Number(r['saturday'] ?? 0));
				sunday.push(Number(r['sunday'] ?? 0));
				startDates.push(r['start_date'] ?? null);
				endDates.push(r['end_date'] ??  null);
			}
			await this.prisma.$executeRawUnsafe(
				`INSERT INTO calendar(service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date)
				SELECT service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday,
					CASE WHEN sd IS NULL THEN NULL ELSE to_date(sd,'YYYYMMDD') END,
					CASE WHEN ed IS NULL THEN NULL ELSE to_date(ed,'YYYYMMDD') END
				FROM unnest(
					$1::text[], $2::int[], $3::int[], $4::int[], $5::int[], $6::int[], $7::int[], $8::int[], $9::text[], $10::text[]
				) AS t(service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, sd, ed)
				ON CONFLICT (service_id) DO NOTHING`,
				serviceIds, monday, tuesday, wednesday, thursday, friday, saturday, sunday, startDates, endDates,
			);
			this.logger.log(`calendar.txt chunk ${i}: inserted ${chunk.length}`);
		}
	}

	private async importCalendarDatesBatched(rows: Record<string, string>[]) {
		const CHUNK = 5000;
		this.logger.log(`Importing calendar_dates.txt in chunks of ${CHUNK}`);
		let i = 0;
		let totalSkipped = 0;
		for (const chunk of this.chunkArray(rows, CHUNK)) {
			i++;
			const serviceIds: (string | null)[] = [];
			const dates: (string | null)[] = [];
			const exceptions: (number | null)[] = [];
			let skipped = 0;
			for (const r of chunk) {
				const sid = r['service_id'] ?? null;
				const d = r['date'] ?? null;
				const excRaw = r['exception_type'];
				const exc = excRaw !== undefined && excRaw !== null ? Number(excRaw) : null;
				if (!sid || !d || (exc !== 1 && exc !== 2)) {
					skipped++;
					continue;
				}
				serviceIds.push(sid);
				dates.push(d);
				exceptions.push(exc);
			}
			totalSkipped += skipped;
			if (serviceIds.length === 0) {
				this.logger.log(`calendar_dates.txt chunk ${i}: skipped ${skipped}, nothing to insert`);
				continue;
			}
			await this.prisma.$executeRawUnsafe(
				`INSERT INTO calendar_dates(service_id, date, exception_type)
				SELECT service_id, CASE WHEN d IS NULL THEN NULL ELSE to_date(d,'YYYYMMDD') END, exception_type
				FROM unnest($1::text[], $2::text[], $3::int[])
				AS t(service_id, d, exception_type)
				ON CONFLICT (service_id, date) DO NOTHING`,
				serviceIds, dates, exceptions,
			);
			this.logger.log(`calendar_dates.txt chunk ${i}: inserted ${serviceIds.length}, skipped ${skipped}`);
		}
		if (totalSkipped > 0) {
			this.logger.log(`calendar_dates.txt total skipped rows: ${totalSkipped}`);
		}
	}

	private async importShapesBatched(rows: Record<string, string>[]) {
		const CHUNK = 10000;
		this.logger.log(`Importing shapes.txt in chunks of ${CHUNK}`);
		let i = 0;
		for (const chunk of this.chunkArray(rows, CHUNK)) {
			i++;
			const shapeIds: (string | null)[] = [];
			const lats: (number | null)[] = [];
			const lons: (number | null)[] = [];
			const seqs: number[] = [];
			const dists: (number | null)[] = [];
			for (const r of chunk) {
				shapeIds.push(r['shape_id'] ?? null);
				lats.push(r['shape_pt_lat'] ? Number(r['shape_pt_lat']) : null);
				lons.push(r['shape_pt_lon'] ? Number(r['shape_pt_lon']) : null);
				seqs.push(r['shape_pt_sequence'] ? Number(r['shape_pt_sequence']) : 0);
				dists.push(r['shape_dist_traveled'] ? Number(r['shape_dist_traveled']) : null);
			}
			await this.prisma.$executeRawUnsafe(
				`INSERT INTO shapes(shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence, shape_dist_traveled)
				SELECT * FROM unnest($1::text[], $2::float8[], $3::float8[], $4::int[], $5::float8[])
				ON CONFLICT (shape_id, shape_pt_sequence) DO NOTHING`,
				shapeIds, lats, lons, seqs, dists,
			);
			this.logger.log(`shapes.txt chunk ${i}: inserted ${chunk.length}`);
		}
	}

	private async importFareAttributesBatched(rows: Record<string, string>[], agencyId: string) {
		const CHUNK = 2000;
		this.logger.log(`Importing fare_attributes.txt in chunks of ${CHUNK}`);
		let i = 0;
		for (const chunk of this.chunkArray(rows, CHUNK)) {
			i++;
			const fareIds: (string | null)[] = [];
			const prices: (number | null)[] = [];
			const currencies: (string | null)[] = [];
			const paymentMethods: (number | null)[] = [];
			const transfers: (number | null)[] = [];
			const agencyIds: (string | null)[] = [];
			for (const r of chunk) {
				fareIds.push(r['fare_id'] ?? null);
				prices.push(r['price'] ? Number(r['price']) : null);
				currencies.push(r['currency_type'] ?? null);
				paymentMethods.push(r['payment_method'] ? Number(r['payment_method']) : null);
				transfers.push(r['transfers'] ? Number(r['transfers']) : null);
				agencyIds.push(agencyId);
			}
			await this.prisma.$executeRawUnsafe(
				`INSERT INTO fare_attributes(fare_id, price, currency_type, payment_method, transfers, agency_id)
				SELECT fare_id, price::numeric, currency_type, payment_method, transfers, agency_id
				FROM unnest($1::text[], $2::text[], $3::text[], $4::int[], $5::int[], $6::text[])
				AS t(fare_id, price, currency_type, payment_method, transfers, agency_id)
				ON CONFLICT (fare_id) DO NOTHING`,
				fareIds, prices.map(v => (v === null ? null : String(v))), currencies, paymentMethods, transfers, agencyIds,
			);
			this.logger.log(`fare_attributes.txt chunk ${i}: inserted ${chunk.length}`);
		}
	}

	private async importFareRulesBatched(rows: Record<string, string>[]) {
		const CHUNK = 5000;
		this.logger.log(`Importing fare_rules.txt in chunks of ${CHUNK}`);
		let i = 0;
		for (const chunk of this.chunkArray(rows, CHUNK)) {
			i++;
			const fareIds: (string | null)[] = [];
			const routeIds: (string | null)[] = [];
			const origins: (string | null)[] = [];
			const dests: (string | null)[] = [];
			const contains: (string | null)[] = [];
			for (const r of chunk) {
				fareIds.push(r['fare_id'] ?? null);
				routeIds.push(r['route_id'] ?? null);
				origins.push(r['origin_id'] ?? null);
				dests.push(r['destination_id'] ?? null);
				contains.push(r['contains_id'] ?? null);
			}
			await this.prisma.$executeRawUnsafe(
				`INSERT INTO fare_rules(fare_id, route_id, origin_id, destination_id, contains_id)
				SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[])
				ON CONFLICT DO NOTHING`,
				fareIds, routeIds, origins, dests, contains,
			);
			this.logger.log(`fare_rules.txt chunk ${i}: inserted ${chunk.length}`);
		}
	}
}

export { GtfsService as __GtfsServiceExportForTs };
