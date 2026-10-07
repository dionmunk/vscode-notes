import * as fs from 'fs';
import * as path from 'path';

// how notes and folders are ordered: by name, A to Z or Z to A, or newest first by date modified or created;
// folders always come first, as in the Explorer
export type SortOrder = 'name' | 'nameDescending' | 'modified' | 'created';

const SORT_ORDERS: SortOrder[] = ['name', 'nameDescending', 'modified', 'created'];

// what the order compares, dates in milliseconds
export interface SortEntry {
	name: string;
	isFolder: boolean;
	modified: number;
	created: number;
}

// the notes.sortOrder setting, name for anything it doesn't know
export function toSortOrder(value: unknown): SortOrder {
	return SORT_ORDERS.includes(value as SortOrder) ? value as SortOrder : 'name';
}

// does this order need the dates of files and folders?
export function needsDates(order: SortOrder): boolean {
	return order === 'modified' || order === 'created';
}

export function compareEntries(a: SortEntry, b: SortEntry, order: SortOrder): number {
	if (a.isFolder !== b.isFolder) {
		return a.isFolder ? -1 : 1;
	}
	switch (order) {
		case 'nameDescending':
			return b.name.localeCompare(a.name);
		// newest first, then by name for the same date
		case 'modified':
			return b.modified - a.modified || a.name.localeCompare(b.name);
		case 'created':
			return b.created - a.created || a.name.localeCompare(b.name);
		default:
			return a.name.localeCompare(b.name);
	}
}

// the name and, when the order needs them, the dates of a file or folder
export function readSortEntry(fullPath: string, isFolder: boolean, order: SortOrder): SortEntry {
	const entry: SortEntry = { name: path.basename(fullPath), isFolder, modified: 0, created: 0 };
	if (needsDates(order)) {
		try {
			const stat = fs.statSync(fullPath);
			entry.modified = stat.mtimeMs;
			// some file systems don't record when a file was created, the date modified is the next best thing
			entry.created = stat.birthtimeMs || stat.mtimeMs;
		} catch (err) {
			// gone since it was listed, it sorts last
		}
	}
	return entry;
}
