import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getLocationState, getMoveDestination, getPortableFolder, isInside, isNoteName, resolveNotesLocation, splitNoteName, toWorkspaceSetting } from '../../location';

suite('Notes Location', () => {
	const home = path.join(path.sep, 'home', 'someone');
	const workspace = path.join(path.sep, 'projects', 'app');

	test('an empty or blank setting is not set', () => {
		assert.strictEqual(resolveNotesLocation('', home, workspace), '');
		assert.strictEqual(resolveNotesLocation('   ', home, workspace), '');
		assert.strictEqual(resolveNotesLocation(undefined, home, workspace), '');
	});

	test('~ is expanded to the home folder', () => {
		assert.strictEqual(resolveNotesLocation('~', home), home);
		assert.strictEqual(resolveNotesLocation('~/notes', home), path.join(home, 'notes'));
		assert.strictEqual(resolveNotesLocation('~' + path.sep + 'notes', home), path.join(home, 'notes'));
	});

	test('a trailing separator is removed', () => {
		assert.strictEqual(resolveNotesLocation('~/notes/', home), path.join(home, 'notes'));
	});

	test('~ inside a name is left alone', () => {
		assert.strictEqual(resolveNotesLocation('~notes', home, workspace), path.join(workspace, '~notes'));
	});

	test('an absolute path is normalized', () => {
		const location = path.join(path.sep, 'data', 'notes');
		assert.strictEqual(resolveNotesLocation(location + path.sep + '.' + path.sep, home, workspace), location);
	});

	test('a relative path is resolved against the workspace folder', () => {
		assert.strictEqual(resolveNotesLocation('./notes', home, workspace), path.join(workspace, 'notes'));
		assert.strictEqual(resolveNotesLocation('notes', home, workspace), path.join(workspace, 'notes'));
	});

	test('a relative path without a workspace folder is not resolved', () => {
		assert.strictEqual(resolveNotesLocation('./notes', home), './notes');
		assert.strictEqual(getLocationState(resolveNotesLocation('./notes', home)), 'missing');
	});

	test('the state of a location reflects the file system', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-location-'));
		const file = path.join(dir, 'note.md');
		fs.writeFileSync(file, '# note');
		try {
			assert.strictEqual(getLocationState(''), 'unset');
			assert.strictEqual(getLocationState(dir), 'ready');
			assert.strictEqual(getLocationState(file), 'missing');
			assert.strictEqual(getLocationState(path.join(dir, 'does-not-exist')), 'missing');
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	test('a workspace notes folder inside the workspace is saved relative to it', () => {
		assert.strictEqual(toWorkspaceSetting(path.join(workspace, '.notes'), workspace), '.notes');
		assert.strictEqual(toWorkspaceSetting(path.join(workspace, 'docs', 'notes'), workspace), 'docs/notes');
		assert.strictEqual(toWorkspaceSetting(workspace, workspace), '.');
	});

	test('a workspace notes folder outside the workspace is saved as a full path', () => {
		const outside = path.join(path.sep, 'projects', 'shared-notes');
		assert.strictEqual(toWorkspaceSetting(outside, workspace), outside);
		assert.strictEqual(toWorkspaceSetting(path.dirname(workspace), workspace), path.dirname(workspace));
	});

	test('a folder named like a parent reference is still inside the workspace', () => {
		assert.strictEqual(toWorkspaceSetting(path.join(workspace, '..notes'), workspace), '..notes');
	});

	test('a saved relative location resolves back to the folder that was picked', () => {
		const picked = path.join(workspace, 'docs', 'notes');
		assert.strictEqual(resolveNotesLocation(toWorkspaceSetting(picked, workspace), home, workspace), picked);
	});

	test('a portable VS Code is the folder holding its portable data folder', () => {
		const install = path.join(path.sep, 'usb', 'VSCode');
		assert.strictEqual(getPortableFolder({ VSCODE_PORTABLE: path.join(install, 'data') }), install);
		assert.strictEqual(getPortableFolder({}), undefined);
		assert.strictEqual(getPortableFolder({ VSCODE_PORTABLE: '' }), undefined);
	});

	test('a relative location in a portable VS Code is inside its folder (#38)', () => {
		const install = path.join(path.sep, 'usb', 'VSCode');
		const portable = getPortableFolder({ VSCODE_PORTABLE: path.join(install, 'data') });
		assert.strictEqual(resolveNotesLocation('data/Notes', home, portable), path.join(install, 'data', 'Notes'));
	});

	test('a path is inside a folder when it is the folder or below it', () => {
		const notes = path.join(path.sep, 'notes');
		assert.strictEqual(isInside(notes, notes), true);
		assert.strictEqual(isInside(path.join(notes, 'work', 'a.md'), notes), true);
		assert.strictEqual(isInside(path.join(path.sep, 'notes-archive'), notes), false);
		assert.strictEqual(isInside(path.join(notes, '..notes'), notes), true);
		assert.strictEqual(isInside(path.sep, notes), false);
	});

	test('moving a note into a folder puts it there', () => {
		const notes = path.join(path.sep, 'notes');
		assert.strictEqual(getMoveDestination(path.join(notes, 'a.md'), path.join(notes, 'work')), path.join(notes, 'work', 'a.md'));
		assert.strictEqual(getMoveDestination(path.join(notes, 'work', 'a.md'), notes), path.join(notes, 'a.md'));
	});

	test('moving into the folder an item is already in does nothing', () => {
		const notes = path.join(path.sep, 'notes');
		assert.strictEqual(getMoveDestination(path.join(notes, 'a.md'), notes), undefined);
		assert.strictEqual(getMoveDestination(path.join(notes, 'work'), notes + path.sep), undefined);
	});

	test('a folder can not be moved into itself or a folder inside it', () => {
		const work = path.join(path.sep, 'notes', 'work');
		assert.strictEqual(getMoveDestination(work, work), undefined);
		assert.strictEqual(getMoveDestination(work, path.join(work, 'old')), undefined);
		// a sibling whose name starts the same is a different folder
		assert.strictEqual(getMoveDestination(work, path.join(path.sep, 'notes', 'work-archive')), path.join(path.sep, 'notes', 'work-archive', 'work'));
	});

	const languages = new Set(['md', 'markdown', 'txt', 'sql', 'json']);

	test('a typed extension VS Code knows a language for is kept when all extensions are allowed (#81)', () => {
		assert.deepStrictEqual(splitNoteName('query.sql', '*', languages), { base: 'query', extension: 'sql' });
		assert.deepStrictEqual(splitNoteName('data.JSON', '*', languages), { base: 'data', extension: 'JSON' });
	});

	test('a name without a usable extension stays whole', () => {
		assert.deepStrictEqual(splitNoteName('Meeting 2026.10.07', '*', languages), { base: 'Meeting 2026.10.07' });
		assert.deepStrictEqual(splitNoteName('plain', '*', languages), { base: 'plain' });
		assert.deepStrictEqual(splitNoteName('.env', '*', languages), { base: '.env' });
	});

	test('with a list of allowed extensions only those count', () => {
		assert.deepStrictEqual(splitNoteName('notes.txt', 'md, txt', languages), { base: 'notes', extension: 'txt' });
		assert.deepStrictEqual(splitNoteName('query.sql', 'md,txt', languages), { base: 'query.sql' });
	});

	test('a typed name refers to a note by its file name or its name without the extension (#34)', () => {
		assert.strictEqual(isNoteName('animals', 'animals.md'), true);
		assert.strictEqual(isNoteName('Animals.MD', 'animals.md'), true);
		assert.strictEqual(isNoteName('  animals ', 'animals.md'), true);
		assert.strictEqual(isNoteName('anim', 'animals.md'), false);
		assert.strictEqual(isNoteName('animals.txt', 'animals.md'), false);
	});
});
