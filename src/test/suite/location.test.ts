import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getLocationState, getPortableFolder, resolveNotesLocation, toWorkspaceSetting } from '../../location';

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
});
