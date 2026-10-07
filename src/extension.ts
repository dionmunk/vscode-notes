import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Note } from './note';
import { NotesViewProvider } from './notesViewProvider';
import { NotesWatcher } from './notesWatcher';
import { getLocationState, resolveNotesLocation } from './location';

let extId = 'vscode-notes';
let extPub = 'dionmunk';

// activate extension
export function activate(context: vscode.ExtensionContext) {

	console.log('"vscode-notes" is active.');

	// get Notes configuration
	let notesTree = new NotesViewProvider(Notes.getNotesLocation(), String(Notes.getNotesExtensions()));
	let notesView = vscode.window.createTreeView('notes', { treeDataProvider: notesTree.init() });

	// keep the tree in sync with changes made outside of this window
	let notesWatcher = new NotesWatcher(notesTree, notesView);
	notesWatcher.restart(Notes.getNotesLocation());
	context.subscriptions.push(notesView, notesWatcher);

	// update the tree and the watcher with the current storage location and extensions
	const updateTree = () => {
		notesTree.update(Notes.getNotesLocation(), String(Notes.getNotesExtensions()));
		notesWatcher.restart(Notes.getNotesLocation());
	};

	// Listen for configuration changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			// apply a new storage location or list of extensions right away
			if (e.affectsConfiguration('notes.notesLocation') || e.affectsConfiguration('notes.notesExtensions')) {
				updateTree();
			}
			// apply new watch settings
			else if (e.affectsConfiguration('notes.watchExternalChanges') || e.affectsConfiguration('notes.watchIntervalSeconds')) {
				notesWatcher.restart(Notes.getNotesLocation());
			}
		})
	);

	// a relative storage location depends on the workspace folder
	context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(updateTree));

	/*
	* register commands
	*/

	// delete note
	let deleteNoteDisposable = vscode.commands.registerCommand('Notes.deleteNote', (note: Note) => {
		Notes.deleteNote(note, notesTree);
	});
	context.subscriptions.push(deleteNoteDisposable);

	// delete folder
	let deleteFolderDisposable = vscode.commands.registerCommand('Notes.deleteFolder', (folder: Note) => {
		Notes.deleteFolder(folder, notesTree);
	});
	context.subscriptions.push(deleteFolderDisposable);

	// list notes
	let listNotesDisposable = vscode.commands.registerCommand('Notes.listNotes', () => {
		Notes.listNotes();
	});
	context.subscriptions.push(listNotesDisposable);

	// new note
	let newNoteDisposable = vscode.commands.registerCommand('Notes.newNote', (folder?: Note) => {
		Notes.newNote(notesTree, folder);
	});
	context.subscriptions.push(newNoteDisposable);

	// new folder
	let newFolderDisposable = vscode.commands.registerCommand('Notes.newFolder', (parentFolder?: Note) => {
		Notes.newFolder(notesTree, parentFolder);
	});
	context.subscriptions.push(newFolderDisposable);

	// open note
	let openNoteDisposable = vscode.commands.registerCommand('Notes.openNote', (note: Note | string) => {
		Notes.openNote(note);
	});
	context.subscriptions.push(openNoteDisposable);

	// refresh notes
	let refreshNotesDisposable = vscode.commands.registerCommand('Notes.refreshNotes', () => {
		Notes.refreshNotes(notesTree);
	});
	context.subscriptions.push(refreshNotesDisposable);

	// rename note
	let renameNoteDisposable = vscode.commands.registerCommand('Notes.renameNote', (note: Note) => {
		Notes.renameNote(note, notesTree);
	});
	context.subscriptions.push(renameNoteDisposable);

	// rename folder
	let renameFolderDisposable = vscode.commands.registerCommand('Notes.renameFolder', (folder: Note) => {
		Notes.renameFolder(folder, notesTree);
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

	// reveal in the file explorer of the operating system
	let revealInOSDisposable = vscode.commands.registerCommand('Notes.revealInOS', (item?: Note) => {
		Notes.revealInOS(item);
	});
	context.subscriptions.push(revealInOSDisposable);

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

	// get notes storage location, with ~ and a path relative to the workspace folder resolved
	static getNotesLocation(): string {
		const notesLocation = vscode.workspace.getConfiguration('notes').get<string>('notesLocation');
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		return resolveNotesLocation(notesLocation, os.homedir(), workspaceFolder);
	}

	// get the notes storage location if it is a usable folder, otherwise tell the user and return undefined
	static requireNotesLocation(): string | undefined {
		const notesLocation = Notes.getNotesLocation();
		if (getLocationState(notesLocation) === 'ready') {
			return notesLocation;
		}

		const message = notesLocation
			? `The notes storage location could not be found: ${notesLocation}`
			: 'You need to select a location to store your notes.';
		vscode.window.showErrorMessage(message, 'Select Location').then(selectedAction => {
			if (selectedAction === 'Select Location') {
				Notes.selectLocation();
			}
		});
		return undefined;
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
	static deleteNote(note: Note, tree: NotesViewProvider): void {
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
	static deleteFolder(folder: Note, tree: NotesViewProvider): void {
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

	// list notes
	static listNotes(): void {
		const notesLocation = Notes.requireNotesLocation();
		if (!notesLocation) {
			return;
		}
		let notesExtensions = String(Notes.getNotesExtensions());
		// read files in storage location
		fs.readdir(String(notesLocation), (err, files) => {
			if (err) {
				// report error
				console.error(err);
				return vscode.window.showErrorMessage('Failed to read the notes folder.');
			}
			else {
				// show list of notes
				vscode.window.showQuickPick(files).then(file => {
					// open selected note
					vscode.window.showTextDocument(vscode.Uri.file(path.join(String(notesLocation), String(file))));
				});
			}
		});
	}

	// new note
	static newNote(tree: NotesViewProvider, folder?: Note): void {
		// Determine the location where the note should be created
		const notesLocation = folder ? path.join(folder.location, folder.name) : Notes.requireNotesLocation();
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

			// set note name
			let fileName: string = `${noteName}`;
			// set note path
			let filePath: string = path.join(notesLocation, `${fileName.replace(/\:/gi, '')}.${notesDefaultNoteExtension}`);
			// set note first line
			let firstLine: string = "# " + fileName + "\n\n";
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
	static newFolder(tree: NotesViewProvider, parentFolder?: Note): void {
		// Determine the location where the folder should be created
		const parentLocation = parentFolder ? path.join(parentFolder.location, parentFolder.name) : Notes.requireNotesLocation();
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

	// reveal a note or folder in the file explorer, or the storage location when no item is given
	static revealInOS(item?: Note): void {
		const target = item ? item.fullPath : Notes.requireNotesLocation();
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
	static renameNote(note: Note, tree: NotesViewProvider): void {
		// If it's a folder, don't try to rename it as a note
		if (note.isFolder) {
			return;
		}

		// get the note's extension
		let noteExtension = note.name.split('.').pop();

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

			// Get the extension without the dot
			let newNoteExtension = path.extname(newNoteName).replace('.', '');
			let noteName: string = '';

			// if new note name extension is in list of allowed extensions
			if (String(Notes.getNotesExtensions()).split(',').includes(newNoteExtension)) {
				// use the new note name
				noteName = newNoteName;
			}
			// else if new note name has no extension
			else if (path.extname(newNoteName) === '') {
				// use the note's current extension
				noteName = newNoteName + '.' + noteExtension;
			}
			// else if new note name has an extension that's not in the allowed list
			else {
				// use the new note name but with the current extension
				noteName = path.basename(newNoteName, path.extname(newNoteName)) + '.' + noteExtension;
			}

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
	static renameFolder(folder: Note, tree: NotesViewProvider): void {
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
				// a location set in the workspace settings overrides the user settings, so update it there
				// otherwise the selected location would be saved but never used
				const inspected = notesConfiguration.inspect<string>('notesLocation');
				const target = inspected?.workspaceValue !== undefined
					? vscode.ConfigurationTarget.Workspace
					: vscode.ConfigurationTarget.Global;
				// update Notes configuration with selected location, the tree picks up the change on its own
				notesConfiguration.update('notesLocation', path.normalize(fileUri[0].fsPath), target).then(undefined, err => {
					console.error(err);
					vscode.window.showErrorMessage('Failed to save the notes storage location.');
				});
			}
		});
	}
}
