import * as vscode from 'vscode';
import * as fs from 'fs';
import * as gl from 'glob';
import * as path from 'path';
import { Note } from './note';

export class NotesProvider implements vscode.TreeDataProvider<Note> {

	private _onDidChangeTreeData: vscode.EventEmitter<Note | undefined> = new vscode.EventEmitter<Note | undefined>();
	readonly onDidChangeTreeData: vscode.Event<Note | undefined> = this._onDidChangeTreeData.event;

	// assign notes location passed to NotesProvider
	constructor(private notesLocation: string) {
	};

	public init(): NotesProvider {
		this.refresh();
		return this;
	}

	// refresh tree if tree data changed
	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	// get TreeItem representation of a note
	getTreeItem(note: Note): vscode.TreeItem {
		return note;
	}

	// get children from notes location
	getChildren(note?: Note): Thenable<Note[]> {
		// if tree provider wasn't given a notes location to check
		if (!this.notesLocation) {
			return Promise.resolve([]);
		}
		// if we get a note return resolved promise
		if (note) {
			return Promise.resolve([]);
		}
		// else return list of notes in notes location
		else {
			return Promise.resolve(this.getNotes(this.notesLocation));
		}
	}

	// get Notes from notes location
	getNotes(notesLocation: string): Note[] {
		// if the notes location exists
		if (this.pathExists(notesLocation)) {
			// create a list of Notes called listOfNotes
			const listOfNotes = (note: string): Note => {
				// return a Note, when a note is clicked on in the view, perform a command
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
			// get list of markdown files in notes location and save them in a list called listOfNotes
			// this is markdown focused so markdown is hard coded
			const notes = gl.sync(`*.md`, { cwd: notesLocation, nodir: true, nocase: true }).map(listOfNotes);
			// return the list of notes
			return notes;
		}
		// if the notes location does not exist
		else {
			// return an empty list
			return [];
		}
	}

	// check to see if the given path exists in the file system
	private pathExists(p: string): boolean {
		// try accessing the given location
		try {
			fs.accessSync(p);
		// error if we can't access given location
		} catch (err) {
			// return false if location does not exist
			return false;
		}
		// return true if location exists
		return true;
	}

}