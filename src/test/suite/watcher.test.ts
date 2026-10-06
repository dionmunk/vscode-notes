import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { NotesViewProvider } from '../../notesViewProvider';

suite('External Changes', () => {
	let notesLocation: string;

	setup(() => {
		notesLocation = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-watch-'));
		fs.writeFileSync(path.join(notesLocation, 'first.md'), '# first\n');
		fs.mkdirSync(path.join(notesLocation, 'folder'));
	});

	teardown(() => {
		fs.rmSync(notesLocation, { recursive: true, force: true });
	});

	// read the tree the way VS Code does when it shows it, with the folder open or not
	async function showTree(openFolder: boolean): Promise<NotesViewProvider> {
		const tree = new NotesViewProvider(notesLocation, '*');
		const root = await tree.getChildren();
		if (openFolder) {
			await tree.getChildren(root.find(note => note.isFolder));
		}
		return tree;
	}

	test('nothing changed since the tree was read', async () => {
		const tree = await showTree(true);
		assert.strictEqual(await tree.hasExternalChanges(), false);
	});

	test('a note added on disk is a change until the tree is read again', async () => {
		const tree = await showTree(false);
		fs.writeFileSync(path.join(notesLocation, 'synced.md'), '# synced\n');
		assert.strictEqual(await tree.hasExternalChanges(), true);

		await tree.getChildren();
		assert.strictEqual(await tree.hasExternalChanges(), false);
	});

	test('a note renamed or removed on disk is a change', async () => {
		const tree = await showTree(false);
		fs.renameSync(path.join(notesLocation, 'first.md'), path.join(notesLocation, 'renamed.md'));
		assert.strictEqual(await tree.hasExternalChanges(), true);

		await tree.getChildren();
		fs.unlinkSync(path.join(notesLocation, 'renamed.md'));
		assert.strictEqual(await tree.hasExternalChanges(), true);
	});

	test('editing a note is not a change', async () => {
		const tree = await showTree(false);
		fs.appendFileSync(path.join(notesLocation, 'first.md'), 'more\n');
		assert.strictEqual(await tree.hasExternalChanges(), false);
	});

	test('a change in an open folder is a change, in a collapsed one it is not', async () => {
		const tree = await showTree(true);
		fs.writeFileSync(path.join(notesLocation, 'folder', 'nested.md'), '# nested\n');
		assert.strictEqual(await tree.hasExternalChanges(), true);

		tree.forgetFolder(path.join(notesLocation, 'folder'));
		assert.strictEqual(await tree.hasExternalChanges(), false);
	});

	test('an open folder removed on disk is reported once', async () => {
		const tree = await showTree(true);
		fs.rmSync(path.join(notesLocation, 'folder'), { recursive: true });
		assert.strictEqual(await tree.hasExternalChanges(), true);

		// after the refresh the folder is gone from the tree and stops being checked
		await tree.getChildren();
		assert.strictEqual(await tree.hasExternalChanges(), false);
	});

	test('a storage location that appears on disk is a change', async () => {
		const missing = path.join(notesLocation, 'later');
		const tree = new NotesViewProvider(missing, '*');
		await tree.getChildren();
		assert.strictEqual(await tree.hasExternalChanges(), false);

		fs.mkdirSync(missing);
		assert.strictEqual(await tree.hasExternalChanges(), true);
	});
});
