import * as path from 'path';

// the storage the history is kept in, the extension's global state in VS Code
export interface HistoryStore {
	get<T>(key: string, defaultValue: T): T;
	update(key: string, value: unknown): Thenable<void>;
}

const KEY = 'recentlyOpenedNotes';
const LIMIT = 50;

// the notes opened most recently, newest first, like the recently opened files of Quick Open;
// kept on this machine only, never in settings or the notes folder
export class RecentNotes {

	constructor(private store: HistoryStore, private limit: number = LIMIT) {
	}

	// note paths, newest first
	get(): string[] {
		return this.store.get<string[]>(KEY, []);
	}

	// a note was opened: put it first
	async add(filePath: string): Promise<void> {
		const recent = this.get();
		if (recent[0] === filePath) {
			return;
		}
		await this.store.update(KEY, [filePath, ...recent.filter(recentPath => recentPath !== filePath)].slice(0, this.limit));
	}

	// a note or folder was moved or renamed: follow it
	async rename(oldPath: string, newPath: string): Promise<void> {
		const recent = this.get();
		const renamed = recent.map(recentPath =>
			recentPath === oldPath ? newPath
				: recentPath.startsWith(oldPath + path.sep) ? newPath + recentPath.slice(oldPath.length)
					: recentPath);
		if (renamed.some((renamedPath, index) => renamedPath !== recent[index])) {
			await this.store.update(KEY, renamed);
		}
	}

	async clear(): Promise<void> {
		await this.store.update(KEY, []);
	}
}
