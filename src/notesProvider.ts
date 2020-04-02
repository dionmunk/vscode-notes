import * as vscode from 'vscode';
import * as fs from 'fs';
import * as gl from 'glob';
import * as path from 'path';
import { Note } from './note';
import { NotesCommon } from './notesCommon';

export class NotesProvider implements vscode.TreeDataProvider<Note> {

	private _onDidChangeTreeData: vscode.EventEmitter<Note | undefined> = new vscode.EventEmitter<Note | undefined>();
	readonly onDidChangeTreeData: vscode.Event<Note | undefined> = this._onDidChangeTreeData.event;

	constructor(private storageLocation: string) {
		console.log('"vscode-notes" storage location: ' + storageLocation);
	};

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: Note): vscode.TreeItem {
		var treeItem = new vscode.TreeItem( element.label );
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        if (element) {
			console.log('"vscode-notes" getTreeItem open note.');
            treeItem.tooltip = "Open note";
            treeItem.command = {
                command: "NotesCommon.openNote",
				title: "Open note",
				arguments: [element.location]
            };
		}
		console.log('"vscode-notes" getTreeItem returning note.');
		return element;
	}

	getChildren(element?: Note): Thenable<Note[]> {
		console.log('"vscode-notes" getting children.');
		if (!this.storageLocation) {
			console.log('"vscode-notes" no notes in storage location.');
			vscode.window.showInformationMessage('No notes in storage location');
			return Promise.resolve([]);
		}
		if (element) {
			return Promise.resolve([]);
		}
		else {
			return Promise.resolve(this.getNotes(this.storageLocation));
		}
	}

	getNotes(notePath: string): Note[] {
		// if the storage location exists
		if (this.pathExists(notePath)) {
			// create a list of Notes called listOfNotes
			const listOfNotes = (item: string): Note => {
				return new Note(path.basename(item), notePath, vscode.TreeItemCollapsibleState.None);
			};
			// get list of markdown files in storage location and save them in a list called listOfNotes
			const notes = gl.sync(`*.md`, { cwd: notePath, nodir: true, nocase: true }).map(listOfNotes);
			// return the list of notes
			return notes;
		}
		// iif the storage location does not exist
		else {
			// return an empty list
			return [];
		}
	}

	private pathExists(p: string): boolean {
		console.log('"vscode-notes" checking if path exists.');
		try {
			fs.accessSync(p);
		} catch (err) {
			console.log('"vscode-notes" path does not exist.');
			return false;
		}
		console.log('"vscode-notes" path exists.');
		return true;
	}
}