import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const csv: any = require('csv-parser');

export async function parseCsv(filePath: string): Promise<Record<string, string>[]> {
	return new Promise((resolve, reject) => {
		const absolute = path.resolve(filePath);
		const rows: Record<string, string>[] = [];
		fs.createReadStream(absolute)
			.pipe(csv())
			.on('data', (data: Record<string, string>) => rows.push(data))
			.on('end', () => resolve(rows))
			.on('error', (err: Error) => reject(err));
	});
}
