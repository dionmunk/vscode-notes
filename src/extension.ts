import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Note } from './note';
import { NotesViewProvider } from './notesViewProvider';
import { NotesWatcher } from './notesWatcher';
import { getLanguageExtensions, isMarkdownFile, resetLanguageExtensions } from './languages';
import { RecentNotes } from './recentNotes';
import { compareEntries, readSortEntry, SortOrder, toSortOrder } from './sortOrder';
import { MovableItem, NotesDragAndDrop } from './notesDragAndDrop';
import { getLocationState, getMoveDestination, getPortableFolder, isInside, isNoteName, resolveNotesLocation, splitNoteName, toWorkspaceSetting } from './location';

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
				|| e.affectsConfiguration('notes.notesExtensions')
				|| e.affectsConfiguration('notes.sortOrder')) {
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
		// a newly installed extension can add a language, like Markdown files with another extension
		vscode.extensions.onDidChange(() => resetLanguageExtensions()),
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

	// remember the notes opened, from Notes or anywhere else, for List Notes
	const recentNotes = new RecentNotes(context.globalState);
	const rememberActiveNote = () => {
		const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
		const uri = input instanceof vscode.TabInputText || input instanceof vscode.TabInputCustom ? input.uri : undefined;
		if (uri?.scheme === 'file' && [notesTree.location, workspaceTree.location].some(location => location && isInside(uri.fsPath, location) && uri.fsPath !== location)) {
			recentNotes.add(uri.fsPath);
		}
	};
	context.subscriptions.push(
		vscode.window.tabGroups.onDidChangeTabs(rememberActiveNote),
		vscode.window.tabGroups.onDidChangeTabGroups(rememberActiveNote),
		vscode.workspace.onDidRenameFiles(e => e.files.forEach(file => recentNotes.rename(file.oldUri.fsPath, file.newUri.fsPath)))
	);

	// list notes
	let listNotesDisposable = vscode.commands.registerCommand('Notes.listNotes', () => {
		Notes.listNotes(trees, recentNotes);
	});
	context.subscriptions.push(listNotesDisposable);

	// choose how notes are sorted
	let sortByDisposable = vscode.commands.registerCommand('Notes.sortBy', () => {
		Notes.pickSortOrder();
	});
	context.subscriptions.push(sortByDisposable);

	// forget the recently opened notes
	let clearRecentNotesDisposable = vscode.commands.registerCommand('Notes.clearRecentlyOpened', async () => {
		await recentNotes.clear();
		vscode.window.showInformationMessage('Cleared the recently opened notes.');
	});
	context.subscriptions.push(clearRecentNotesDisposable);

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

	// open the Markdown preview of a note
	let openPreviewDisposable = vscode.commands.registerCommand('Notes.openPreview', (note: Note) => {
		Notes.openPreview(note);
	});
	context.subscriptions.push(openPreviewDisposable);

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

	// search the notes with VS Code's search: every section, one section, or one folder
	let searchNotesDisposable = vscode.commands.registerCommand('Notes.searchNotes', () => {
		Notes.searchNotes();
	});
	context.subscriptions.push(searchNotesDisposable);

	let searchInNotesDisposable = vscode.commands.registerCommand('Notes.searchInNotes', () => {
		Notes.searchNotes('notes');
	});
	context.subscriptions.push(searchInNotesDisposable);

	let searchInWorkspaceNotesDisposable = vscode.commands.registerCommand('Notes.searchInWorkspaceNotes', () => {
		Notes.searchNotes('workspace');
	});
	context.subscriptions.push(searchInWorkspaceNotesDisposable);

	let searchInFolderDisposable = vscode.commands.registerCommand('Notes.searchInFolder', (folder?: Note) => {
		Notes.searchNotes(undefined, folder);
	});
	context.subscriptions.push(searchInFolderDisposable);

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

	// list notes, from Workspace Notes and Notes and the folders in them; typing a name that isn't a note
	// offers to create it, so Enter creates the note when nothing matches (#34)
	static async listNotes(tree: Refreshable, recentNotes: RecentNotes): Promise<void> {
		const sources = [{ label: 'Notes', location: Notes.getNotesLocation() }];
		if (Notes.isWorkspaceNotesAvailable()) {
			sources.unshift({ label: 'Workspace Notes', location: Notes.getWorkspaceNotesLocation() });
		}
		const ready = sources.filter(source => getLocationState(source.location) === 'ready');
		if (!ready.length) {
			Notes.requireLocation('notes');
			return;
		}

		type NoteItem = vscode.QuickPickItem & { filePath?: string, createIn?: string };
		const notes: NoteItem[] = [];
		for (const source of ready) {
			for (const filePath of await listNoteFiles(source.location, String(Notes.getNotesExtensions()))) {
				// where the note is: its section when there are two, and its folder
				const folder = path.relative(source.location, path.dirname(filePath)).split(path.sep).join('/');
				const where = [ready.length > 1 ? source.label : '', folder].filter(Boolean).join(' › ');
				notes.push({ label: path.basename(filePath), description: where || undefined, filePath });
			}
		}

		// notes opened recently come first, newest first, like Quick Open; the others stay in name order
		const recent = recentNotes.get()
			.map(filePath => notes.find(note => note.filePath === filePath))
			.filter((note): note is NoteItem => !!note);
		// the other notes in the order chosen for the tree; by name they stay grouped by folder
		const order = toSortOrder(vscode.workspace.getConfiguration('notes').get('sortOrder'));
		const others = notes.filter(note => !recent.includes(note));
		if (order !== 'name') {
			const entries = new Map(others.map(note => [note, readSortEntry(note.filePath!, false, order)]));
			others.sort((a, b) => compareEntries(entries.get(a)!, entries.get(b)!, order));
		}
		const listed: NoteItem[] = recent.length
			? [{ label: 'recently opened', kind: vscode.QuickPickItemKind.Separator }, ...recent, { label: 'other notes', kind: vscode.QuickPickItemKind.Separator }, ...others]
			: others;

		const quickPick = vscode.window.createQuickPick<NoteItem>();
		quickPick.placeholder = 'Open a note, or type a name to create one';
		quickPick.matchOnDescription = true;
		quickPick.items = listed;
		quickPick.onDidChangeValue(value => {
			const name = value.trim();
			// offer to create the typed name in each section, unless a note already has that name
			const create: NoteItem[] = !name || notes.some(note => isNoteName(name, note.label)) ? [] : ready.map(source => ({
				label: `$(new-file) Create '${name}'`,
				description: ready.length > 1 ? `in ${source.label}` : undefined,
				alwaysShow: true,
				createIn: source.location
			}));
			// while typing, VS Code ranks the matches itself, so the headings would label the wrong notes
			quickPick.items = name ? [...notes, ...create] : listed;
		});
		quickPick.onDidAccept(async () => {
			const picked = quickPick.activeItems[0];
			const name = quickPick.value.trim();
			quickPick.hide();
			if (picked?.filePath) {
				Notes.openNote(picked.filePath);
			}
			else if (picked?.createIn && name) {
				await Notes.createNote(picked.createIn, name, tree);
			}
		});
		quickPick.onDidHide(() => quickPick.dispose());
		quickPick.show();
	}

	// choose how notes and folders are sorted, saved in the notes.sortOrder setting
	static pickSortOrder(): void {
		const config = vscode.workspace.getConfiguration('notes');
		const current = toSortOrder(config.get('sortOrder'));
		const options: { order: SortOrder, label: string, description: string }[] = [
			{ order: 'name', label: 'Name', description: 'A to Z' },
			{ order: 'nameDescending', label: 'Name', description: 'Z to A' },
			{ order: 'modified', label: 'Date Modified', description: 'newest first' },
			{ order: 'created', label: 'Date Created', description: 'newest first' },
		];
		type SortItem = vscode.QuickPickItem & { order: SortOrder };
		// menus can't show a check mark for an extension, the list marks the current order instead
		const items: SortItem[] = options.map(option => ({
			label: `${option.order === current ? '$(check)' : '$(blank)'} ${option.label}`,
			description: option.description,
			order: option.order
		}));

		const quickPick = vscode.window.createQuickPick<SortItem>();
		quickPick.placeholder = 'Sort notes by';
		quickPick.items = items;
		quickPick.activeItems = items.filter(item => item.order === current);
		quickPick.onDidAccept(() => {
			const picked = quickPick.activeItems[0];
			quickPick.hide();
			if (picked && picked.order !== current) {
				// where the setting is in effect, the workspace settings when they set it
				const target = config.inspect('sortOrder')?.workspaceValue !== undefined
					? vscode.ConfigurationTarget.Workspace
					: vscode.ConfigurationTarget.Global;
				config.update('sortOrder', picked.order, target).then(undefined, err => {
					console.error(err);
					vscode.window.showErrorMessage('Failed to save the sort order.');
				});
			}
		});
		quickPick.onDidHide(() => quickPick.dispose());
		quickPick.show();
	}

	// new note
	static async newNote(tree: Refreshable, kind?: NotesKind, item?: Note): Promise<void> {
		// Determine the location where the note should be created
		const notesLocation = await Notes.getTargetFolder(kind, item);
		if (!notesLocation) {
			return;
		}
		// prompt user for a new note name
		const noteName = await vscode.window.showInputBox({
			prompt: 'Note name?',
			value: '',
		});
		if (noteName) {
			await Notes.createNote(notesLocation, noteName, tree);
		}
	}

	// create a note in a folder and open it, keeping an extension typed with the name, like query.sql,
	// otherwise using the default one
	static async createNote(folder: string, noteName: string, tree: Refreshable): Promise<void> {
		const languages = getLanguageExtensions();
		const { base, extension } = splitNoteName(noteName, String(Notes.getNotesExtensions()), new Set(languages.keys()));
		const noteExtension = extension ?? String(Notes.getNotesDefaultNoteExtension());
		// set note path
		const filePath = path.join(folder, `${base.replace(/\:/gi, '')}.${noteExtension}`);
		// a Markdown note starts with its name as a heading, other files start empty
		const markdown = isMarkdownFile(`note.${noteExtension}`);
		const firstLine = markdown ? `# ${base}\n\n` : '';

		// if a note with name already exists
		if (fs.existsSync(filePath)) {
			vscode.window.showWarningMessage('A note with that name already exists.');
			return;
		}
		try {
			// write the file to the storage location
			await fs.promises.writeFile(filePath, firstLine, { flag: 'wx' });
		} catch (err) {
			// report error
			console.error(err);
			vscode.window.showErrorMessage('Failed to create the new note.');
			return;
		}
		// refresh tree after creating new note
		tree.refresh();
		// open file and go to last line in new file
		await vscode.window.showTextDocument(vscode.Uri.file(filePath));
		vscode.commands.executeCommand('cursorMove', { 'to': 'viewPortBottom' });
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

		// open it like the Explorer does: with the editor associated with the file type, like the image viewer
		// for an image, or the preview for Markdown when the user associated it with that
		vscode.commands.executeCommand('vscode.open', vscode.Uri.file(filePath));
	}

	// open the Markdown preview of a note, as Open Preview does in the Explorer
	static openPreview(note: Note): void {
		if (note instanceof Note && !note.isFolder) {
			vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.file(note.fullPath));
		}
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
			const { extension } = splitNoteName(newNoteName, String(Notes.getNotesExtensions()), new Set(getLanguageExtensions().keys()));
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

	// open VS Code's search limited to notes: a folder, one section, or Workspace Notes and Notes together
	// VS Code searches folders named this way even outside the workspace or when they are in .gitignore
	static searchNotes(kind?: NotesKind, folder?: Note): void {
		let folders: string[];
		if (folder instanceof Note && folder.isFolder) {
			folders = [folder.fullPath];
		}
		else if (kind) {
			const location = Notes.requireLocation(kind);
			folders = location ? [location] : [];
		}
		else {
			const kinds: NotesKind[] = Notes.isWorkspaceNotesAvailable() ? ['workspace', 'notes'] : ['notes'];
			folders = kinds.map(Notes.getLocation).filter(location => getLocationState(location) === 'ready');
			if (!folders.length) {
				Notes.requireLocation('notes');
			}
		}
		if (!folders.length) {
			return;
		}

		vscode.commands.executeCommand('workbench.action.findInFiles', {
			filesToInclude: folders.join(', '),
			showIncludesExcludes: true,
			triggerSearch: true
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
	static setupNotes(): void {
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

// every note below a folder, in its folders too, leaving out hidden files and folders and, like the tree,
// files whose extension isn't allowed
async function listNoteFiles(folder: string, notesExtensions: string): Promise<string[]> {
	const allowed = notesExtensions.split(',').map(extension => extension.trim().toLowerCase());
	let entries: fs.Dirent[];
	try {
		entries = await fs.promises.readdir(folder, { withFileTypes: true });
	} catch (err) {
		return [];
	}
	const files: string[] = [];
	for (const entry of entries.filter(entry => !entry.name.startsWith('.')).sort((a, b) => a.name.localeCompare(b.name))) {
		const entryPath = path.join(folder, entry.name);
		if (entry.isDirectory()) {
			files.push(...await listNoteFiles(entryPath, notesExtensions));
		}
		else if (entry.isFile() && (allowed.includes('*') || allowed.includes(path.extname(entry.name).slice(1).toLowerCase()))) {
			files.push(entryPath);
		}
	}
	return files;
}
