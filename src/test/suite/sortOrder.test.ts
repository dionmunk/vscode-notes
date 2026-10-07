import * as assert from 'assert';
import { compareEntries, SortEntry, SortOrder, toSortOrder } from '../../sortOrder';

suite('Sort Order (#22, #63)', () => {
	const entries: SortEntry[] = [
		{ name: 'beta.md', isFolder: false, modified: 300, created: 100 },
		{ name: 'alpha.md', isFolder: false, modified: 100, created: 300 },
		{ name: 'gamma.md', isFolder: false, modified: 200, created: 200 },
		{ name: 'work', isFolder: true, modified: 50, created: 50 },
		{ name: 'archive', isFolder: true, modified: 400, created: 10 },
	];
	const sorted = (order: SortOrder) => [...entries].sort((a, b) => compareEntries(a, b, order)).map(entry => entry.name);

	test('by name, folders first', () => {
		assert.deepStrictEqual(sorted('name'), ['archive', 'work', 'alpha.md', 'beta.md', 'gamma.md']);
	});

	test('by name from Z to A, folders still first', () => {
		assert.deepStrictEqual(sorted('nameDescending'), ['work', 'archive', 'gamma.md', 'beta.md', 'alpha.md']);
	});

	test('by date modified, newest first', () => {
		assert.deepStrictEqual(sorted('modified'), ['archive', 'work', 'beta.md', 'gamma.md', 'alpha.md']);
	});

	test('by date created, newest first', () => {
		assert.deepStrictEqual(sorted('created'), ['work', 'archive', 'alpha.md', 'gamma.md', 'beta.md']);
	});

	test('the same date falls back to the name', () => {
		const same: SortEntry[] = [{ name: 'b.md', isFolder: false, modified: 1, created: 1 }, { name: 'a.md', isFolder: false, modified: 1, created: 1 }];
		assert.deepStrictEqual(same.sort((a, b) => compareEntries(a, b, 'modified')).map(entry => entry.name), ['a.md', 'b.md']);
	});

	test('an unknown setting sorts by name', () => {
		assert.strictEqual(toSortOrder('size'), 'name');
		assert.strictEqual(toSortOrder(undefined), 'name');
		assert.strictEqual(toSortOrder('modified'), 'modified');
	});
});
