// figure out how to reload treeview when notes location changes
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Note } from './note';
import { NotesProvider } from './notesProvider';

let extId = 'vscode-notes';
let extPub = 'dionmunk';

// activate extension
export function activate(context: vscode.ExtensionContext) {

	console.log('"vscode-notes" is active.');

	// get Notes configuration
	let notesTree = new NotesProvider(String(Notes.getNotesLocation()), String(Notes.getNotesExtensions()));
	vscode.window.registerTreeDataProvider('notes', notesTree.init());

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

	// get notes storage location
	static getNotesLocation() {
		return vscode.workspace.getConfiguration('notes').get('notesLocation');
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
	static deleteNote(note: Note, tree: NotesProvider): void {
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
				});
				// refresh tree after deleting note
				tree.refresh();
			}
		});
	}

	// delete folder
	static deleteFolder(folder: Note, tree: NotesProvider): void {
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

				// Use rimraf or fs.rmdir with recursive option
				const rimraf = require('rimraf');
				rimraf(folderPath, (err: Error | null) => {
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
		let notesLocation = String(Notes.getNotesLocation());
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
	static newNote(tree: NotesProvider, folder?: Note): void {
		// Determine the location where the note should be created
		let notesLocation = folder ? path.join(folder.location, folder.name) : String(Notes.getNotesLocation());
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
						// open file
						let file = vscode.Uri.file(filePath);
						vscode.window.showTextDocument(file).then(() => {
							// go to last line in new file
							vscode.commands.executeCommand('cursorMove', { 'to': 'viewPortBottom' });
						});
					}
				});
				// refresh tree after creating new note
				tree.refresh();
			}
			else {
				// report
				return vscode.window.showWarningMessage('A note with that name already exists.');
			}
		});
	}

	// new folder
	static newFolder(tree: NotesProvider, parentFolder?: Note): void {
		// Determine the location where the folder should be created
		let parentLocation = parentFolder ? path.join(parentFolder.location, parentFolder.name) : String(Notes.getNotesLocation());

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
						vscode.window.showInformationMessage(`Successfully created folder ${folderName}.`);
					}
				});
				// refresh tree after creating new folder
				tree.refresh();
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

	// refresh notes
	static refreshNotes(tree: NotesProvider): void {
		// refresh tree
		tree.refresh();
	}

	// rename note
	static renameNote(note: Note, tree: NotesProvider): void {
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
	static renameFolder(folder: Note, tree: NotesProvider): void {
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
	static setupNotes(): void {
		// dialog options
		let openDialogOptions: vscode.OpenDialogOptions = {
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: 'Select'
		};

		// display open dialog with above options
		vscode.window.showOpenDialog(openDialogOptions).then(fileUri => {
			if (fileUri && fileUri[0]) {
				// get Notes configuration
				let notesConfiguration = vscode.workspace.getConfiguration('notes');
				// update Notes configuration with selected location
				notesConfiguration.update('notesLocation', path.normalize(fileUri[0].fsPath), true).then(() => {
					// prompt to reload window so storage location change can take effect
					vscode.window.showWarningMessage(
						`You must reload the window for the storage location change to take effect.`,
						'Reload'
					).then(selectedAction => {
						// if the user selected to reload the window then reload
						if (selectedAction === 'Reload') {
							vscode.commands.executeCommand('workbench.action.reloadWindow');
						}
					});
				});
			}
		});
	}
}
