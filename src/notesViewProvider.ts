import * as vscode from 'vscode';
import * as fs from 'fs';
import * as gl from 'glob';
import * as path from 'path';
import { Note } from './note';

export class NotesViewProvider implements vscode.TreeDataProvider<Note> {

    private _onDidChangeTreeData: vscode.EventEmitter<Note | undefined> = new vscode.EventEmitter<Note | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Note | undefined> = this._onDidChangeTreeData.event;
    private folderMap: Map<string, Note[]> = new Map<string, Note[]>();

    // constructor for NotesViewProvider
    constructor(
        private notesLocation: string,
        private notesExtensions: string) {
    };

    // initialize NotesViewProvider
    public init(): NotesViewProvider {
        this.refresh();
        return this;
    }

    // refresh the tree view
    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
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

        // if there is a parent note and it's a folder
        if (note && note.isFolder) {
            // Return the children of this folder
            return Promise.resolve(this.getNotes(note.fullPath, this.notesExtensions));
        }
        // if there is a note but it's not a folder, return empty list
        else if (note) {
            return Promise.resolve([]);
        }
        // else return the list of notes at the root level
        else {
            return Promise.resolve(this.getNotes(this.notesLocation, this.notesExtensions));
        }
    }

    // get the notes in the notes location
    getNotes(notesLocation: string, notesExtensions: string): Note[] {
        // if the notes location exists
        if (this.pathExists(notesLocation)) {
            const result: Note[] = [];

            // First, add all folders
            try {
                const items = fs.readdirSync(notesLocation, { withFileTypes: true });

                // Add folders first
                for (const item of items) {
                    if (item.isDirectory()) {
                        const folderPath = path.join(notesLocation, item.name);
                        const folderNote = new Note(
                            item.name,
                            notesLocation,
                            '', // category
                            '', // tags
                            true // isDirectory
                        );
                        result.push(folderNote);
                    }
                }

                // Then add notes
                const listOfNotes = (note: string): Note => {
                    // return a note with the given note name, notes location, empty category, empty tags, and the command to open the note
                    return new Note(
                        path.basename(note),
                        notesLocation,
                        '', // category
                        '', // tags
                        false, // isDirectory
                        {
                            command: 'Notes.openNote',
                            title: '',
                            arguments: [path.join(notesLocation, note)]
                        });
                };

                // get the list of notes in the notes location
                let notes;
                if (notesExtensions === '*') {
                    // If '*' is specified, get all files (excluding directories)
                    notes = gl.sync('*', { cwd: notesLocation, nodir: true, nocase: true }).map(listOfNotes);
                } else {
                    // Otherwise, filter by the specified extensions
                    notes = gl.sync(`*.{${notesExtensions}}`, { cwd: notesLocation, nodir: true, nocase: true }).map(listOfNotes);
                }
                result.push(...notes);
            } catch (err) {
                console.error('Error reading directory:', err);
            }

            // Sort: folders first, then notes alphabetically
            result.sort((a, b) => {
                if (a.isFolder && !b.isFolder) {
                    return -1;
                }
                if (!a.isFolder && b.isFolder) {
                    return 1;
                }
                return a.name.localeCompare(b.name);
            });

            return result;
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
