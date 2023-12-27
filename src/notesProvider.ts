import * as vscode from 'vscode';
import * as fs from 'fs';
import * as gl from 'glob';
import * as path from 'path';
import { Note } from './note';

export class NotesProvider implements vscode.TreeDataProvider<Note> {

	private _onDidChangeTreeData: vscode.EventEmitter<Note | undefined> = new vscode.EventEmitter<Note | undefined>();
	readonly onDidChangeTreeData: vscode.Event<Note | undefined> = this._onDidChangeTreeData.event;

	// constructor for NotesProvider
	constructor(
		private notesLocation: string,
		private notesExtensions: string) {
	};

	// initialize NotesProvider
	public init(): NotesProvider {
		this.refresh();
		return this;
	}

	// refresh the tree view
	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	// get the parent of a note
	getTreeItem(note: Note): vscode.TreeItem {
		return note;
	}

	// get the children of a note
	getChildren(note?: Note): Thenable<Note[]> {
		// if there is no notes location return an empty list
		if (!this.notesLocation) {
			return Promise.resolve([]);
		}
		// else if there is a note return an empty list
		if (note) {
			return Promise.resolve([]);
		}
		// else return the list of notes
		else {
			return Promise.resolve(this.getNotes(this.notesLocation, this.notesExtensions));
		}
	}

	// get the notes in the notes location
	getNotes(notesLocation: string, notesExtensions: string): Note[] {
		// if the notes location exists
		if (this.pathExists(notesLocation)) {
			// return a note
			const listOfNotes = (note: string): Note => {
				// return a note with the given note name, notes location, empty category, empty tags, and the command to open the note
				return new Note(
					path.basename(note),
					notesLocation,
					'', // category
					'', // tags
					{
						command: 'Notes.openNote',
						title: '',
						arguments: [note]
					});
			};
			// get the list of notes in the notes location
			const notes = gl.sync(`*.{${notesExtensions}}`, { cwd: notesLocation, nodir: true, nocase: true }).map(listOfNotes);
			// return the list of notes
			return notes;
		}
		// else if the notes location does not exist
		else {
			// return an empty list
			return [];
		}
	}

	// check if a path exists
	private pathExists(p: string): boolean {
		// try to access the given location
		try {
			fs.accessSync(p);
			// return false if location does not exist
		} catch (err) {
			return false;
		}
		// return true if location exists
		return true;
	}

}