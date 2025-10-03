import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

type VarMap = Record<string, string>;

function parsePsqlVars(sql: string): VarMap {
	const vars: VarMap = {};
	const lines = sql.split(/\r?\n/);
	for (const line of lines) {
		const match = line.match(/^\\set\s+([A-Za-z_][A-Za-z0-9_]*)\s+(.+)$/);
		if (!match) continue;
		const key = match[1];
		let val = match[2];
		if (!key || val === undefined) continue;
		val = val.trim();
		if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
			val = val.slice(1, -1);
		}
		vars[key] = val;
	}
	return vars;
}

function findVarNames(sql: string): string[] {
	const names = new Set<string>();
	const re = /:(\w+)|:\"(\w+)\"|:'(\w+)'/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(sql))) {
		const name = (m[1] || m[2] || m[3]) as string | undefined;
		if (name) names.add(name);
	}
	return Array.from(names);
}

function defaultForVar(name: string): string {
	const n = name.toLowerCase();
	if (n.includes('walk') && n.includes('radius')) return '200'; // meters
	if (n.includes('walk') && (n.includes('speed') || n.endsWith('mps'))) return '1.3'; // m/s
	if (n.includes('transfer') && n.includes('penalty')) return '120'; // seconds
	if (n.includes('wait') && n.includes('penalty')) return '60';
	if (n.includes('max') && n.includes('distance')) return '2000';
	if (n.includes('max') && n.includes('time')) return '1800';
	return '0';
}

function applyDefaults(vars: VarMap, needed: string[]): VarMap {
	const filled: VarMap = { ...vars };
	for (const k of needed) {
		if (filled[k] === undefined) filled[k] = defaultForVar(k);
	}
	return filled;
}

function substituteVars(sql: string, vars: VarMap): string {
	const escapeSqlString = (v: string) => v.replace(/'/g, "''");
	let out = sql;
	// :'var' → quoted string
	out = out.replace(/:'(\w+)'/g, (_m, vname: string) => {
		const v = vars[vname];
		return `'${escapeSqlString((v ?? ''))}'`;
	});
	// :"var" → quoted identifier
	out = out.replace(/:\"(\w+)\"/g, (_m, vname: string) => {
		const v = vars[vname];
		return `"${(v ?? '')}"`;
	});
	// :var not preceded by another ':' (to avoid matching '::type' casts)
	out = out.replace(/(^|[^:]):(\w+)/g, (_m, pre: string, vname: string) => {
		if (vars[vname] !== undefined) return `${pre}${String(vars[vname])}`;
		return `${pre}:${vname}`;
	});
	return out;
}

function targetedFallbacks(sql: string, vars: VarMap): string {
	let out = sql;
	const tp = vars['transfer_penalty'] ?? '120';
	const ws = vars['walk_speed'] ?? '1.25';
	const wr = vars['walk_radius'] ?? '500';
	// Common patterns with casts and coalesce
	out = out.replace(/coalesce\(\s*:transfer_penalty::int\s*,\s*\d+\s*\)/gi, tp + '::int');
	out = out.replace(/coalesce\(\s*:walk_speed::numeric\s*,\s*[0-9.]+\s*\)/gi, ws + '::numeric');
	out = out.replace(/coalesce\(\s*:walk_radius::int\s*,\s*\d+\s*\)/gi, wr + '::int');
	// Raw placeholders
	out = out.replace(/(^|[^:]):transfer_penalty(\b)/gi, (_m, pre: string) => `${pre}${tp}`);
	out = out.replace(/(^|[^:]):walk_speed(\b)/gi, (_m, pre: string) => `${pre}${ws}`);
	out = out.replace(/(^|[^:]):walk_radius(\b)/gi, (_m, pre: string) => `${pre}${wr}`);
	return out;
}

function splitSqlStatements(sql: string): string[] {
	const statements: string[] = [];
	let current = '';
	let inSingle = false;
	let inDouble = false;
	let inDollar: string | null = null;
	for (let i = 0; i < sql.length; i++) {
		const ch = sql[i];
		const next2 = sql.substring(i, i + 2);
		if (!inSingle && !inDouble && !inDollar && next2 === '--') {
			while (i < sql.length && sql[i] !== '\n') i++;
			current += '\n';
			continue;
		}
		if (!inSingle && !inDouble && ch === '$') {
			const rest = sql.substring(i);
			const match = rest.match(/^\$[a-zA-Z_]*\$/);
			if (match) {
				const tag = match[0];
				if (inDollar === null) {
					inDollar = tag;
					current += tag;
					i += tag.length - 1;
					continue;
				} else if (inDollar === tag) {
					inDollar = null;
					current += tag;
					i += tag.length - 1;
					continue;
				}
			}
		}
		if (!inDollar) {
			if (ch === "'" && !inDouble) inSingle = !inSingle;
			if (ch === '"' && !inSingle) inDouble = !inDouble;
		}
		current += ch;
		if (!inSingle && !inDouble && !inDollar && ch === ';') {
			statements.push(current.trim());
			current = '';
		}
	}
	if (current.trim().length) statements.push(current.trim());
	return statements
		.map(s => s.trim())
		.filter(s => s.length > 0)
		.filter(s => !s.startsWith('\\'))
		.filter(s => !/^SET\s+/i.test(s));
}

@Injectable()
export class GtfsGraphService {
	private readonly logger = new Logger(GtfsGraphService.name);

	constructor(private readonly prisma: PrismaService) {}

	async buildGraph() {
		const sqlPath = path.resolve(process.cwd(), 'sql', '02_edges_build.sql');
		if (!fs.existsSync(sqlPath)) {
			throw new Error(`SQL script not found: ${sqlPath}`);
		}
		const raw = fs.readFileSync(sqlPath, 'utf8');
		const varsFromScript = parsePsqlVars(raw);
		const neededNames = findVarNames(raw);
		const vars = applyDefaults(varsFromScript, neededNames);
		// First do targeted fallbacks for known variables to keep casts valid
		const withFallbacks = targetedFallbacks(raw, vars);
		const substituted1 = substituteVars(withFallbacks, vars);
		const substituted = substituted1; // no global 0 guard, rely on targeted + substitution
		const statements = splitSqlStatements(substituted);
		this.logger.log(`Executing graph build: ${statements.length} SQL statements (vars: ${Object.keys(vars).map(k=>k+"="+vars[k]).join(', ')})`);
		for (let idx = 0; idx < statements.length; idx++) {
			const stmtRaw = statements[idx] ?? '';
			const stmt = String(stmtRaw);
			if (!stmt.trim()) {
				this.logger.log(`Skip empty statement ${idx + 1}/${statements.length}`);
				continue;
			}
			// Only flag unresolved variables of the form :name NOT preceded by ':' (to avoid matching '::type')
			if (/(^|[^:]):\w+/.test(stmt)) {
				this.logger.error(`Unresolved variable in statement ${idx + 1}/${statements.length}: ${stmt.substring(0, 120)}...`);
				continue;
			}
			try {
				await this.prisma.$executeRawUnsafe(stmt);
				this.logger.log(`Executed ${idx + 1}/${statements.length}`);
			} catch (err) {
				this.logger.error(`Failed at ${idx + 1}/${statements.length}: ${(err as Error).message}`);
			}
		}
		const [{ count: nodesStr } = { count: '0' }] = await this.prisma.$queryRawUnsafe<any[]>(
			'SELECT COUNT(*)::text as count FROM node_route_stop'
		);
		const [{ count: edgesStr } = { count: '0' }] = await this.prisma.$queryRawUnsafe<any[]>(
			'SELECT COUNT(*)::text as count FROM edges'
		);
		const nodes = Number(nodesStr ?? '0');
		const edges = Number(edgesStr ?? '0');
		if (edges === 0) {
			const [{ c: stCnt } = { c: '0' }] = await this.prisma.$queryRawUnsafe<any[]>("SELECT COUNT(*)::text c FROM stop_times");
			const [{ c: tripsCnt } = { c: '0' }] = await this.prisma.$queryRawUnsafe<any[]>("SELECT COUNT(*)::text c FROM trips");
			const [{ c: stopsCnt } = { c: '0' }] = await this.prisma.$queryRawUnsafe<any[]>("SELECT COUNT(*)::text c FROM stops");
			this.logger.warn(`Edges=0. Core counts: stop_times=${stCnt}, trips=${tripsCnt}, stops=${stopsCnt}. Check SQL variables and script logic.`);
		}
		// Créer les index de performance
		this.logger.log('Creating performance indexes...');
		try {
			await this.prisma.$executeRawUnsafe(`
				-- Index sur edges pour les requêtes BFS
				CREATE INDEX IF NOT EXISTS edges_from_idx ON edges(from_node);
				CREATE INDEX IF NOT EXISTS edges_to_idx ON edges(to_node);
				
				-- Index sur node_route_stop pour les jointures
				CREATE INDEX IF NOT EXISTS nrs_stop_idx ON node_route_stop(stop_id);
				
				-- Index composite pour les requêtes de routing
				CREATE INDEX IF NOT EXISTS edges_from_to_idx ON edges(from_node, to_node);
				
				-- Index sur routes pour les jointures
				CREATE INDEX IF NOT EXISTS routes_agency_idx ON routes(agency_id);
				
				-- Index sur agency pour les jointures
				CREATE INDEX IF NOT EXISTS agency_id_idx ON agency(agency_id);
			`);
			this.logger.log('Performance indexes created successfully');
		} catch (error) {
			this.logger.warn(`Failed to create some indexes: ${error}`);
		}

		this.logger.log(`Graph built: nodes=${nodes}, edges=${edges}`);
		return { status: 'graph built', nodes, edges };
	}
}
