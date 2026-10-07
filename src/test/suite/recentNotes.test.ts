import * as assert from 'assert';
import * as path from 'path';
import { HistoryStore, RecentNotes } from '../../recentNotes';

// the extension's global state, kept in memory
class MemoryStore implements HistoryStore {
	private values = new Map<string, unknown>();
	get<T>(key: string, defaultValue: T): T {
		return this.values.has(key) ? this.values.get(key) as T : defaultValue;
	}
	async update(key: string, value: unknown): Promise<void> {
		this.values.set(key, value);
	}
}

suite('Recently Opened Notes (#18)', () => {
	const notes = path.join(path.sep, 'notes');
	const note = (...parts: string[]) => path.join(notes, ...parts);

	test('the note opened last comes first, without duplicates', async () => {
		const recent = new RecentNotes(new MemoryStore());
		await recent.add(note('zz.md'));
		await recent.add(note('todo.md'));
		await recent.add(note('zz.md'));
		assert.deepStrictEqual(recent.get(), [note('zz.md'), note('todo.md')]);
	});

	test('only the most recent notes are kept', async () => {
		const recent = new RecentNotes(new MemoryStore(), 3);
		for (const name of ['a', 'b', 'c', 'd']) {
			await recent.add(note(`${name}.md`));
		}
		assert.deepStrictEqual(recent.get(), [note('d.md'), note('c.md'), note('b.md')]);
	});

	test('a moved note keeps its place', async () => {
		const recent = new RecentNotes(new MemoryStore());
		await recent.add(note('todo.md'));
		await recent.add(note('zz.md'));
		await recent.rename(note('todo.md'), note('archive', 'todo.md'));
		assert.deepStrictEqual(recent.get(), [note('zz.md'), note('archive', 'todo.md')]);
	});

	test('notes in a renamed folder follow it, notes in a folder with a similar name do not', async () => {
		const recent = new RecentNotes(new MemoryStore());
		await recent.add(note('work-old', 'a.md'));
		await recent.add(note('work', 'b.md'));
		await recent.rename(note('work'), note('projects'));
		assert.deepStrictEqual(recent.get(), [note('projects', 'b.md'), note('work-old', 'a.md')]);
	});

	test('clearing forgets every note', async () => {
		const recent = new RecentNotes(new MemoryStore());
		await recent.add(note('todo.md'));
		await recent.clear();
		assert.deepStrictEqual(recent.get(), []);
	});
});
