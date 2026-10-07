import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Note } from './note';
import { NotesViewProvider } from './notesViewProvider';
import { NotesWatcher } from './notesWatcher';
import { MovableItem, NotesDragAndDrop } from './notesDragAndDrop';
import { getLocationState, getMoveDestination, getPortableFolder, isInside, resolveNotesLocation, splitNoteName, toWorkspaceSetting } from './location';

let extId = 'vscode-notes';
let extPub = 'dionmunk';

// which storage location: Notes, from the user settings, or Workspace Notes
type NotesKind = 'notes' | 'workspace';

// what the commands refresh after they change notes on disk
interface Refreshable {
	refresh(): void;
}

// activate extension
export function activate(context: vscode.ExtensionContext) {

	console.log('"vscode-notes" is active.');

	// dragging and dropping moves notes, refreshing both trees (only called once activation is done)
	const moveItems = (items: readonly MovableItem[], targetFolder: string) => Notes.moveItems(items, targetFolder, trees);

	// Notes: the location in your user settings, the same in every window
	let notesTree = new NotesViewProvider('', String(Notes.getNotesExtensions()));
	let notesView = vscode.window.createTreeView('notes', {
		treeDataProvider: notesTree.init(),
		dragAndDropController: new NotesDragAndDrop(() => notesTree.location, moveItems),
		canSelectMany: true
	});
	// Workspace Notes: the notes of the open workspace, shown above Notes when it has some
	let workspaceTree = new NotesViewProvider('', String(Notes.getNotesExtensions()), 'notes.workspaceLocationState');
	let workspaceView = vscode.window.createTreeView('workspaceNotes', {
		treeDataProvider: workspaceTree.init(),
		dragAndDropController: new NotesDragAndDrop(() => workspaceTree.location, moveItems),
		canSelectMany: true
	});

	// keep both trees in sync with changes made outside of this window
	let notesWatcher = new NotesWatcher(notesTree, notesView);
	let workspaceWatcher = new NotesWatcher(workspaceTree, workspaceView);
	context.subscriptions.push(notesView, workspaceView, notesWatcher, workspaceWatcher);

	// a note or folder can be in either tree, so commands that change one refresh both
	const trees: Refreshable = {
		refresh: () => {
			notesTree.refresh();
			workspaceTree.refresh();
		}
	};

	// point the trees and their watchers at the current locations, force when a setting they use changed
	const updateTrees = (force: boolean) => {
		const notesExtensions = String(Notes.getNotesExtensions());

		const notesLocation = Notes.getNotesLocation();
		if (force || notesLocation !== notesTree.location) {
			notesTree.update(notesLocation, notesExtensions);
			notesWatcher.restart(notesLocation);
		}

		// the Workspace Notes view is only shown when the workspace has notes
		const available = Notes.isWorkspaceNotesAvailable();
		vscode.commands.executeCommand('setContext', 'notes.workspaceNotesAvailable', available);
		workspaceView.description = available ? vscode.workspace.name : undefined;

		const workspaceLocation = available ? Notes.getWorkspaceNotesLocation() : '';
		if (force || workspaceLocation !== workspaceTree.location) {
			workspaceTree.update(workspaceLocation, notesExtensions);
			workspaceWatcher.restart(workspaceLocation);
		}
	};
	updateTrees(true);

	context.subscriptions.push(
		// Listen for configuration changes
		vscode.workspace.onDidChangeConfiguration(e => {
			// apply a new storage location or list of extensions right away
			if (e.affectsConfiguration('notes.notesLocation')
				|| e.affectsConfiguration('notes.workspaceNotesLocation')
				|| e.affectsConfiguration('notes.notesExtensions')) {
				updateTrees(true);
			}
			// apply new watch settings
			else if (e.affectsConfiguration('notes.watchExternalChanges') || e.affectsConfiguration('notes.watchIntervalSeconds')) {
				notesWatcher.restart(notesTree.location);
				workspaceWatcher.restart(workspaceTree.location);
			}
		}),
		// relative locations depend on the workspace folder
		vscode.workspace.onDidChangeWorkspaceFolders(() => updateTrees(true)),
		// a workspace notes folder may have been created while the window was in the background
		vscode.window.onDidChangeWindowState(state => {
			if (state.focused) {
				updateTrees(false);
			}
		})
	);

	/*
	* register commands
	*/

	// delete note
	let deleteNoteDisposable = vscode.commands.registerCommand('Notes.deleteNote', (note: Note) => {
		Notes.deleteNote(note, trees);
	});
	context.subscriptions.push(deleteNoteDisposable);

	// delete folder
	let deleteFolderDisposable = vscode.commands.registerCommand('Notes.deleteFolder', (folder: Note) => {
		Notes.deleteFolder(folder, trees);
	});
	context.subscriptions.push(deleteFolderDisposable);

	// list notes
	let listNotesDisposable = vscode.commands.registerCommand('Notes.listNotes', () => {
		Notes.listNotes();
	});
	context.subscriptions.push(listNotesDisposable);

	// new note, in the folder of the given item, or asking where when the workspace has notes too
	let newNoteDisposable = vscode.commands.registerCommand('Notes.newNote', (item?: Note) => {
		Notes.newNote(trees, undefined, item);
	});
	context.subscriptions.push(newNoteDisposable);

	// new folder, in the folder of the given item, or asking where when the workspace has notes too
	let newFolderDisposable = vscode.commands.registerCommand('Notes.newFolder', (item?: Note) => {
		Notes.newFolder(trees, undefined, item);
	});
	context.subscriptions.push(newFolderDisposable);

	// new note and new folder from the title bar and welcome content of each view
	for (const [command, kind, create] of [
		['Notes.newNoteInNotes', 'notes', Notes.newNote],
		['Notes.newFolderInNotes', 'notes', Notes.newFolder],
		['Notes.newNoteInWorkspaceNotes', 'workspace', Notes.newNote],
		['Notes.newFolderInWorkspaceNotes', 'workspace', Notes.newFolder],
	] as [string, NotesKind, typeof Notes.newNote][]) {
		context.subscriptions.push(vscode.commands.registerCommand(command, (item?: Note) => {
			create(trees, kind, item);
		}));
	}

	// open note
	let openNoteDisposable = vscode.commands.registerCommand('Notes.openNote', (note: Note | string) => {
		Notes.openNote(note);
	});
	context.subscriptions.push(openNoteDisposable);

	// refresh notes
	let refreshNotesDisposable = vscode.commands.registerCommand('Notes.refreshNotes', () => {
		updateTrees(true);
	});
	context.subscriptions.push(refreshNotesDisposable);

	// rename note
	let renameNoteDisposable = vscode.commands.registerCommand('Notes.renameNote', (note: Note) => {
		Notes.renameNote(note, trees);
	});
	context.subscriptions.push(renameNoteDisposable);

	// move notes and folders, the selected ones when the clicked item is part of the selection
	let moveDisposable = vscode.commands.registerCommand('Notes.move', async (item?: Note, items?: Note[]) => {
		const selected = (items?.length ? items : item ? [item] : []).filter(selectedItem => selectedItem instanceof Note);
		const targetFolder = selected.length ? await Notes.pickMoveTarget(selected) : undefined;
		if (targetFolder) {
			await Notes.moveItems(selected, targetFolder, trees);
		}
	});
	context.subscriptions.push(moveDisposable);

	// rename folder
	let renameFolderDisposable = vscode.commands.registerCommand('Notes.renameFolder', (folder: Note) => {
		Notes.renameFolder(folder, trees);
	});
	context.subscriptions.push(renameFolderDisposable);

	// setup notes
	let setupNotesDisposable = vscode.commands.registerCommand('Notes.setupNotes', () => {
		Notes.setupNotes();
	});
	context.subscriptions.push(setupNotesDisposable);

	// select storage location
	let selectLocationDisposable = vscode.commands.registerCommand('Notes.selectLocation', () => {
		Notes.selectLocation();
	});
	context.subscriptions.push(selectLocationDisposable);

	// select workspace notes location
	let selectWorkspaceLocationDisposable = vscode.commands.registerCommand('Notes.selectWorkspaceLocation', () => {
		Notes.selectWorkspaceLocation();
	});
	context.subscriptions.push(selectWorkspaceLocationDisposable);

	// set up workspace notes in .notes
	let setUpWorkspaceNotesDisposable = vscode.commands.registerCommand('Notes.setUpWorkspaceNotes', () => {
		Notes.setUpWorkspaceNotes().then(() => updateTrees(true));
	});
	context.subscriptions.push(setUpWorkspaceNotesDisposable);

	// create a storage location that is set but does not exist yet
	let createNotesFolderDisposable = vscode.commands.registerCommand('Notes.createNotesFolder', () => {
		Notes.createLocationFolder('notes').then(() => updateTrees(true));
	});
	context.subscriptions.push(createNotesFolderDisposable);

	let createWorkspaceNotesFolderDisposable = vscode.commands.registerCommand('Notes.createWorkspaceNotesFolder', () => {
		Notes.createLocationFolder('workspace').then(() => updateTrees(true));
	});
	context.subscriptions.push(createWorkspaceNotesFolderDisposable);

	// reveal in the file explorer of the operating system
	let revealInOSDisposable = vscode.commands.registerCommand('Notes.revealInOS', (item?: Note) => {
		Notes.revealInOS(item, 'notes');
	});
	context.subscriptions.push(revealInOSDisposable);

	let revealWorkspaceNotesInOSDisposable = vscode.commands.registerCommand('Notes.revealWorkspaceNotesInOS', (item?: Note) => {
		Notes.revealInOS(item, 'workspace');
	});
	context.subscriptions.push(revealWorkspaceNotesInOSDisposable);

};

// this method is called when extension is deactivated
export function deactivate() {
	/*
	* everything registered in context.subscriptions,
	* so nothing to do here for now
	*/
}

export class Notes {

	constructor(
		public settings: vscode.WorkspaceConfiguration
	) {
		this.settings = vscode.workspace.getConfiguration(extId);
	}

	// the first workspace folder, which relative locations are resolved against
	static getWorkspaceFolder(): string | undefined {
		return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	}

	// get notes storage location, with ~ and a relative path resolved: against the folder holding a portable
	// VS Code, so the notes travel with it, otherwise against the workspace folder
	// only the user settings count: a notesLocation in workspace settings is that workspace's notes
	static getNotesLocation(): string {
		const notesLocation = vscode.workspace.getConfiguration('notes').inspect<string>('notesLocation')?.globalValue;
		return resolveNotesLocation(notesLocation, os.homedir(), getPortableFolder() ?? Notes.getWorkspaceFolder());
	}

	// get the workspace notes location, '' without a workspace folder or a location
	// a notesLocation set in the workspace settings, from before workspace notes existed, is used too
	static getWorkspaceNotesLocation(): string {
		const workspaceFolder = Notes.getWorkspaceFolder();
		if (!workspaceFolder) {
			return '';
		}
		const config = vscode.workspace.getConfiguration('notes');
		const location = config.get<string>('workspaceNotesLocation') || config.inspect<string>('notesLocation')?.workspaceValue;
		return resolveNotesLocation(location, os.homedir(), workspaceFolder);
	}

	// workspace notes are shown when their folder exists, or when the workspace settings name one
	// a relative location in the user settings applies to every workspace, those without the folder show nothing
	static isWorkspaceNotesAvailable(): boolean {
		const location = Notes.getWorkspaceNotesLocation();
		if (!location) {
			return false;
		}
		if (getLocationState(location) === 'ready') {
			return true;
		}
		const config = vscode.workspace.getConfiguration('notes');
		return config.inspect('workspaceNotesLocation')?.workspaceValue !== undefined
			|| config.inspect('notesLocation')?.workspaceValue !== undefined;
	}

	static getLocation(kind: NotesKind): string {
		return kind === 'workspace' ? Notes.getWorkspaceNotesLocation() : Notes.getNotesLocation();
	}

	// get a storage location if it is a usable folder, otherwise tell the user how to fix it and return undefined
	static requireLocation(kind: NotesKind): string | undefined {
		const location = Notes.getLocation(kind);
		if (getLocationState(location) === 'ready') {
			return location;
		}

		const workspace = kind === 'workspace';
		if (location) {
			const message = workspace
				? `The workspace notes location could not be found: ${location}`
				: `The notes storage location could not be found: ${location}`;
			vscode.window.showErrorMessage(message, 'Create Folder', 'Select Location').then(selectedAction => {
				if (selectedAction === 'Create Folder') {
					vscode.commands.executeCommand(workspace ? 'Notes.createWorkspaceNotesFolder' : 'Notes.createNotesFolder');
				}
				else if (selectedAction === 'Select Location') {
					workspace ? Notes.selectWorkspaceLocation() : Notes.selectLocation();
				}
			});
		}
		else if (workspace) {
			vscode.window.showErrorMessage('This workspace doesn\'t have a notes location yet.', 'Set Up Workspace Notes').then(selectedAction => {
				if (selectedAction === 'Set Up Workspace Notes') {
					vscode.commands.executeCommand('Notes.setUpWorkspaceNotes');
				}
			});
		}
		else {
			vscode.window.showErrorMessage('You need to select a location to store your notes.', 'Select Location').then(selectedAction => {
				if (selectedAction === 'Select Location') {
					Notes.selectLocation();
				}
			});
		}
		return undefined;
	}

	// ask whether a new note goes in Workspace Notes or Notes, when the workspace has notes
	static async pickKind(): Promise<NotesKind | undefined> {
		if (!Notes.isWorkspaceNotesAvailable()) {
			return 'notes';
		}
		const picked = await vscode.window.showQuickPick([
			{ label: 'Workspace Notes', description: vscode.workspace.name, target: 'workspace' as NotesKind },
			{ label: 'Notes', description: 'all workspaces', target: 'notes' as NotesKind },
		], { placeHolder: 'Where should it go?' });
		return picked?.target;
	}

	// the folder to create a note or folder in: next to the given item, or at the root of a storage location
	static async getTargetFolder(kind?: NotesKind, item?: Note): Promise<string | undefined> {
		if (item instanceof Note) {
			return item.isFolder ? item.fullPath : item.location;
		}
		const target = kind ?? await Notes.pickKind();
		return target ? Notes.requireLocation(target) : undefined;
	}
	// the file extensions VS Code has a language for, with the language, from every installed extension
	// including the built-in ones
	static getLanguageExtensions(): Map<string, string> {
		// plain text is registered by VS Code itself rather than by an extension
		const languages = new Map<string, string>([['txt', 'plaintext']]);
		for (const extension of vscode.extensions.all) {
			for (const language of extension.packageJSON?.contributes?.languages ?? []) {
				for (const fileExtension of language.extensions ?? []) {
					const key = String(fileExtension).replace(/^\./, '').toLowerCase();
					if (!languages.has(key)) {
						languages.set(key, language.id);
					}
				}
			}
		}
		return languages;
	}

	// get notes default extension
	static getNotesDefaultNoteExtension() {
		return vscode.workspace.getConfiguration('notes').get('notesDefaultNoteExtension');
	}
	// get notes default extension
	static getNotesExtensions() {
		return vscode.workspace.getConfiguration('notes').get('notesExtensions');
	}

	// delete note
	static deleteNote(note: Note, tree: Refreshable): void {
		// prompt user for confirmation
		vscode.window.showWarningMessage(`Are you sure you want to delete '${note.name}'? This action is permanent and can not be reversed.`, 'Yes', 'No').then(result => {
			// if the user answers Yes
			if (result === 'Yes') {
				// try to delete the note
				fs.unlink(path.join(String(note.location), String(note.name)), (err) => {
					// if there was an error deleting the note
					if (err) {
						// report error
						console.error(err);
						return vscode.window.showErrorMessage(`Failed to delete ${note.name}.`);
					}
					// else let the user know the file was deleted successfully
					vscode.window.showInformationMessage(`Successfully deleted ${note.name}.`);
					// refresh tree after deleting note
					tree.refresh();
				});
			}
		});
	}

	// delete folder
	static deleteFolder(folder: Note, tree: Refreshable): void {
		if (!folder.isFolder) {
			vscode.window.showErrorMessage('Selected item is not a folder.');
			return;
		}

		// prompt user for confirmation
		vscode.window.showWarningMessage(`Are you sure you want to delete folder '${folder.name}' and all its contents? This action is permanent and can not be reversed.`, 'Yes', 'No').then(result => {
			// if the user answers Yes
			if (result === 'Yes') {
				// try to delete the folder recursively
				const folderPath = path.join(folder.location, folder.name);

				fs.rm(folderPath, { recursive: true }, err => {
					// if there was an error deleting the folder
					if (err) {
						// report error
						console.error(err);
						vscode.window.showErrorMessage(`Failed to delete folder ${folder.name}.`);
						return;
					}
					// else let the user know the folder was deleted successfully
					vscode.window.showInformationMessage(`Successfully deleted folder ${folder.name}.`);

					// refresh tree after deleting folder
					tree.refresh();
				});
			}
		});
	}

	// list notes, from Workspace Notes and Notes
	static async listNotes(): Promise<void> {
		const sources = [{ label: 'Notes', location: Notes.getNotesLocation() }];
		if (Notes.isWorkspaceNotesAvailable()) {
			sources.unshift({ label: 'Workspace Notes', location: Notes.getWorkspaceNotesLocation() });
		}
		const ready = sources.filter(source => getLocationState(source.location) === 'ready');
		if (!ready.length) {
			Notes.requireLocation('notes');
			return;
		}

		// read the notes in each storage location, the label tells them apart when there are two
		const items: (vscode.QuickPickItem & { filePath: string })[] = [];
		for (const source of ready) {
			try {
				for (const entry of await fs.promises.readdir(source.location, { withFileTypes: true })) {
					if (entry.isFile() && !entry.name.startsWith('.')) {
						items.push({
							label: entry.name,
							description: ready.length > 1 ? source.label : undefined,
							filePath: path.join(source.location, entry.name)
						});
					}
				}
			} catch (err) {
				// report error
				console.error(err);
				vscode.window.showErrorMessage(`Failed to read ${source.location}.`);
			}
		}

		// show list of notes and open the selected one
		const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Open a note' });
		if (picked) {
			vscode.window.showTextDocument(vscode.Uri.file(picked.filePath));
		}
	}

	// new note
	static async newNote(tree: Refreshable, kind?: NotesKind, item?: Note): Promise<void> {
		// Determine the location where the note should be created
		const notesLocation = await Notes.getTargetFolder(kind, item);
		if (!notesLocation) {
			return;
		}
		let notesDefaultNoteExtension = String(Notes.getNotesDefaultNoteExtension());

		// prompt user for a new note name
		vscode.window.showInputBox({
			prompt: 'Note name?',
			value: '',
		}).then(noteName => {
			if (!noteName) {
				return; // User cancelled
			}

			// keep an extension typed with the name, like query.sql, otherwise use the default one
			const languages = Notes.getLanguageExtensions();
			const { base, extension } = splitNoteName(noteName, String(Notes.getNotesExtensions()), new Set(languages.keys()));
			const noteExtension = extension ?? notesDefaultNoteExtension;
			// set note path
			let filePath: string = path.join(notesLocation, `${base.replace(/\:/gi, '')}.${noteExtension}`);
			// a Markdown note starts with its name as a heading, other files start empty
			const markdown = languages.get(noteExtension.toLowerCase()) === 'markdown' || ['md', 'markdown'].includes(noteExtension.toLowerCase());
			let firstLine: string = markdown ? `# ${base}\n\n` : '';
			// does note exist already?
			let noteExists = fs.existsSync(String(filePath));

			// if a note with name doesn't already exist
			if (!noteExists) {
				// try writing the file to the storage location
				fs.writeFile(filePath, firstLine, err => {
					if (err) {
						// report error
						console.error(err);
						return vscode.window.showErrorMessage('Failed to create the new note.');
					}
					else {
						// refresh tree after creating new note
						tree.refresh();
						// open file
						let file = vscode.Uri.file(filePath);
						vscode.window.showTextDocument(file).then(() => {
							// go to last line in new file
							vscode.commands.executeCommand('cursorMove', { 'to': 'viewPortBottom' });
						});
					}
				});
			}
			else {
				// report
				return vscode.window.showWarningMessage('A note with that name already exists.');
			}
		});
	}

	// new folder
	static async newFolder(tree: Refreshable, kind?: NotesKind, item?: Note): Promise<void> {
		// Determine the location where the folder should be created
		const parentLocation = await Notes.getTargetFolder(kind, item);
		if (!parentLocation) {
			return;
		}

		// prompt user for a new folder name
		vscode.window.showInputBox({
			prompt: 'Folder name?',
			value: '',
		}).then(folderName => {
			if (!folderName) {
				return; // User cancelled
			}

			// set folder path
			let folderPath: string = path.join(parentLocation, folderName);

			// does folder exist already?
			let folderExists = fs.existsSync(String(folderPath));

			// if a folder with name doesn't already exist
			if (!folderExists) {
				// try creating the folder
				fs.mkdir(folderPath, { recursive: true }, err => {
					if (err) {
						// report error
						console.error(err);
						return vscode.window.showErrorMessage('Failed to create the new folder.');
					}
					else {
						// refresh tree after creating new folder
						tree.refresh();
						vscode.window.showInformationMessage(`Successfully created folder ${folderName}.`);
					}
				});
			}
			else {
				// report
				return vscode.window.showWarningMessage('A folder with that name already exists.');
			}
		});
	}

	// open note
	static openNote(note: Note | string): void {
		// If it's a Note object and a folder, don't try to open it
		if (typeof note !== 'string' && note.isFolder) {
			return;
		}

		let filePath: string;

		// If note is a string (full path)
		if (typeof note === 'string') {
			// Use the path directly
			filePath = note;
		}
		// If note is a Note object
		else {
			// Use the note's location and name to construct the path
			filePath = path.join(String(note.location), String(note.name));
		}

		// Open the document
		vscode.window.showTextDocument(vscode.Uri.file(filePath));
	}

	// reveal a note or folder in the file explorer, or a storage location when no item is given
	static revealInOS(item: Note | undefined, kind: NotesKind): void {
		const target = item instanceof Note ? item.fullPath : Notes.requireLocation(kind);
		if (!target) {
			return;
		}

		// on WSL the extension runs on the Linux side and the built-in command gets a path Windows can't open,
		// so the path is translated and Explorer is called directly
		if (vscode.env.remoteName === 'wsl') {
			cp.execFile('wslpath', ['-w', target], (err, stdout) => {
				if (err) {
					console.error(err);
					vscode.window.showErrorMessage(`Failed to reveal '${target}' in the file explorer.`);
					return;
				}
				// a folder is opened, a note is selected in the folder holding it
				const windowsPath = stdout.trim();
				// Explorer exits with a non zero code even when it worked, so its result is ignored
				cp.execFile('explorer.exe', [item && !item.isFolder ? `/select,${windowsPath}` : windowsPath], () => { });
			});
			return;
		}

		vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(target)).then(undefined, err => {
			console.error(err);
			vscode.window.showErrorMessage(`Failed to reveal '${target}' in the file explorer.`);
		});
	}

	// refresh notes
	static refreshNotes(tree: NotesViewProvider): void {
		// refresh tree
		tree.refresh();
	}

	// rename note
	static renameNote(note: Note, tree: Refreshable): void {
		// If it's a folder, don't try to rename it as a note
		if (note.isFolder) {
			return;
		}

		// get the note's extension, '' for a note without one
		let noteExtension = path.extname(note.name).slice(1);

		// prompt user for new note name
		vscode.window.showInputBox({
			prompt: 'New note name?',
			value: note.name
		}).then(newNoteName => {
			// if no new note name or note name didn't change
			if (!newNoteName || newNoteName === note.name) {
				// do nothing
				return;
			}

			// use the new name as typed when it ends with an extension a note can have, like a.txt,
			// otherwise keep the current extension, so a name like 'Meeting 2026.10.07' stays whole
			const { extension } = splitNoteName(newNoteName, String(Notes.getNotesExtensions()), new Set(Notes.getLanguageExtensions().keys()));
			let noteName: string = extension || !noteExtension ? newNoteName : `${newNoteName}.${noteExtension}`;

			// check for existing note with the same name
			let newNotePath = path.join(note.location, noteName);
			if (fs.existsSync(newNotePath)) {
				vscode.window.showWarningMessage(`'${noteName}' already exists.`);
				// do nothing
				return;
			}

			// else save the note
			vscode.window.showInformationMessage(`'${note.name}' renamed to '${noteName}'.`);
			fs.renameSync(path.join(note.location, note.name), newNotePath);

			// refresh tree after renaming note
			tree.refresh();
		});
	}

	// rename folder
	static renameFolder(folder: Note, tree: Refreshable): void {
		// If it's not a folder, don't try to rename it as a folder
		if (!folder.isFolder) {
			return;
		}

		// prompt user for new folder name
		vscode.window.showInputBox({
			prompt: 'New folder name?',
			value: folder.name
		}).then(newFolderName => {
			// if no new folder name or folder name didn't change
			if (!newFolderName || newFolderName === folder.name) {
				// do nothing
				return;
			}

			// check for existing folder with the same name
			let newFolderPath = path.join(folder.location, newFolderName);
			if (fs.existsSync(newFolderPath)) {
				vscode.window.showWarningMessage(`'${newFolderName}' already exists.`);
				// do nothing
				return;
			}

			// else rename the folder
			vscode.window.showInformationMessage(`'${folder.name}' renamed to '${newFolderName}'.`);
			fs.renameSync(path.join(folder.location, folder.name), newFolderPath);

			// refresh tree after renaming folder
			tree.refresh();
		});
	}

	// move notes and folders into a folder, through VS Code so open editors follow them
	static async moveItems(items: readonly MovableItem[], targetFolder: string, tree: Refreshable): Promise<void> {
		// a note inside a folder that moves too goes along with it
		const moving = items.filter(item => !items.some(other => other !== item && other.isFolder && isInside(item.fullPath, other.fullPath)));
		const problems: string[] = [];
		let moved = 0;

		for (const item of moving) {
			const destination = getMoveDestination(item.fullPath, targetFolder);
			if (!destination) {
				if (item.isFolder && isInside(targetFolder, item.fullPath)) {
					problems.push(`'${item.name}' can't be moved into itself.`);
				}
				continue;
			}
			if (fs.existsSync(destination)) {
				problems.push(`'${item.name}' already exists in '${path.basename(targetFolder)}'.`);
				continue;
			}
			const edit = new vscode.WorkspaceEdit();
			edit.renameFile(vscode.Uri.file(item.fullPath), vscode.Uri.file(destination), { overwrite: false });
			if (await vscode.workspace.applyEdit(edit)) {
				moved++;
			}
			else {
				problems.push(`Failed to move '${item.name}'.`);
			}
		}

		if (moved) {
			tree.refresh();
		}
		if (problems.length) {
			vscode.window.showWarningMessage(problems.join(' '));
		}
	}

	// pick a folder to move notes and folders into, from Workspace Notes and Notes
	static async pickMoveTarget(items: readonly MovableItem[]): Promise<string | undefined> {
		const sections = [{ label: 'Notes', root: Notes.getNotesLocation() }];
		if (Notes.isWorkspaceNotesAvailable()) {
			sections.unshift({ label: 'Workspace Notes', root: Notes.getWorkspaceNotesLocation() });
		}

		const picks: (vscode.QuickPickItem & { folder?: string })[] = [];
		for (const section of sections) {
			if (getLocationState(section.root) !== 'ready') {
				continue;
			}
			// only folders where at least one of the items can go
			const folders = [section.root, ...await listFolders(section.root)]
				.filter(folder => items.some(item => getMoveDestination(item.fullPath, folder)));
			if (!folders.length) {
				continue;
			}
			picks.push({ label: section.label, kind: vscode.QuickPickItemKind.Separator });
			for (const folder of folders) {
				const relative = path.relative(section.root, folder);
				picks.push(relative
					? { label: `$(folder) ${relative.split(path.sep).join('/')}`, folder }
					: { label: `$(root-folder) ${section.label}`, description: 'top level', folder });
			}
		}

		if (!picks.length) {
			vscode.window.showInformationMessage('There is no other folder to move to.');
			return undefined;
		}
		const what = items.length === 1 ? `'${items[0].name}'` : `${items.length} items`;
		const picked = await vscode.window.showQuickPick(picks, { placeHolder: `Move ${what} to` });
		return picked?.folder;
	}

	// setup notes
	static setupNotes(tree?: NotesViewProvider): void {
		// Check if notesLocation is not null
		const notesLocation = Notes.getNotesLocation();
		if (notesLocation) {
			// If notesLocation is not null, take the user to the extension settings
			vscode.commands.executeCommand('workbench.action.openSettings', `@ext:dionmunk.vscode-notes`);
			return;
		}

		// If notesLocation is null, show dialog to select a folder
		Notes.selectLocation();
	}

	// select a folder to store notes in
	static selectLocation(): void {
		const notesLocation = Notes.getNotesLocation();
		let openDialogOptions: vscode.OpenDialogOptions = {
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: 'Select',
			// start in the current location if it exists
			defaultUri: getLocationState(notesLocation) === 'ready' ? vscode.Uri.file(notesLocation) : undefined
		};

		// display open dialog with above options
		vscode.window.showOpenDialog(openDialogOptions).then(fileUri => {
			if (fileUri && fileUri[0]) {
				// get Notes configuration
				let notesConfiguration = vscode.workspace.getConfiguration('notes');
				// update the user settings with the selected location, the tree picks up the change on its own
				notesConfiguration.update('notesLocation', path.normalize(fileUri[0].fsPath), vscode.ConfigurationTarget.Global).then(undefined, err => {
					console.error(err);
					vscode.window.showErrorMessage('Failed to save the notes storage location.');
				});
			}
		});
	}

	// select a folder for this workspace's notes
	static selectWorkspaceLocation(): void {
		const workspaceFolder = Notes.getWorkspaceFolder();
		if (!workspaceFolder) {
			vscode.window.showWarningMessage('Open a folder to use workspace notes.');
			return;
		}
		const workspaceLocation = Notes.getWorkspaceNotesLocation();
		let openDialogOptions: vscode.OpenDialogOptions = {
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: 'Select',
			// start in the current location if it exists, otherwise in the workspace folder
			defaultUri: vscode.Uri.file(getLocationState(workspaceLocation) === 'ready' ? workspaceLocation : workspaceFolder)
		};

		vscode.window.showOpenDialog(openDialogOptions).then(fileUri => {
			if (fileUri && fileUri[0]) {
				Notes.saveWorkspaceLocation(toWorkspaceSetting(fileUri[0].fsPath, workspaceFolder));
			}
		});
	}

	// save the workspace notes location in the workspace settings
	// a notesLocation in the workspace settings, from before workspace notes existed, is replaced by it
	static async saveWorkspaceLocation(location: string): Promise<void> {
		const config = vscode.workspace.getConfiguration('notes');
		try {
			await config.update('workspaceNotesLocation', location, vscode.ConfigurationTarget.Workspace);
			if (config.inspect<string>('notesLocation')?.workspaceValue !== undefined) {
				await config.update('notesLocation', undefined, vscode.ConfigurationTarget.Workspace);
			}
		} catch (err) {
			console.error(err);
			vscode.window.showErrorMessage('Failed to save the workspace notes location.');
		}
	}

	// give this workspace notes in .notes, or create the folder a workspace notes location already names
	static async setUpWorkspaceNotes(): Promise<void> {
		const workspaceFolder = Notes.getWorkspaceFolder();
		if (!workspaceFolder) {
			vscode.window.showWarningMessage('Open a folder to use workspace notes.');
			return;
		}

		const configured = Notes.getWorkspaceNotesLocation();
		const location = configured || path.join(workspaceFolder, '.notes');
		try {
			await fs.promises.mkdir(location, { recursive: true });
		} catch (err) {
			console.error(err);
			vscode.window.showErrorMessage(`Failed to create ${location}.`);
			return;
		}
		if (!configured) {
			await Notes.saveWorkspaceLocation('.notes');
		}
		vscode.commands.executeCommand('workspaceNotes.focus');
	}

	// create a storage location that is set but does not exist yet
	static async createLocationFolder(kind: NotesKind): Promise<void> {
		const location = Notes.getLocation(kind);
		// a relative location without a workspace folder has nowhere to go
		if (!location || !path.isAbsolute(location)) {
			return;
		}
		try {
			await fs.promises.mkdir(location, { recursive: true });
		} catch (err) {
			console.error(err);
			vscode.window.showErrorMessage(`Failed to create ${location}.`);
		}
	}
}

// every folder below a folder, depth first and sorted by name
async function listFolders(folder: string): Promise<string[]> {
	let entries: fs.Dirent[];
	try {
		entries = await fs.promises.readdir(folder, { withFileTypes: true });
	} catch (err) {
		return [];
	}
	const folders: string[] = [];
	for (const entry of entries.filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
		const child = path.join(folder, entry.name);
		folders.push(child, ...await listFolders(child));
	}
	return folders;
}
