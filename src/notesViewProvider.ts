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
            let entries: fs.Dirent[];

            try {
              entries = fs.readdirSync(notesLocation, { withFileTypes: true });
            } catch (err) {
              console.error('Error reading directory:', err);
              entries = [];
            }

            const result: Note[] = entries
                .filter(entry => {
                  return entry.name != ".DS_Store" && entry.name != ".git" && (notesExtensions === '*' || entry.isDirectory()|| notesExtensions.includes(path.extname(entry.name)))
                })
                .map(entry => {
                  let note: Note;

                  if (entry.isDirectory()) {
                    note = new Note(
                        entry.name,
                        notesLocation,
                        '', // category
                        '', // tags
                        true // isDirectory
                    );
                  } else {
                    // return a note with the given note name, notes location, empty category, empty tags, and the command to open the note
                    note = new Note(
                        entry.name,
                        notesLocation,
                        '', // category
                        '', // tags
                        false, // isDirectory
                        {
                            command: 'Notes.openNote',
                            title: '',
                            arguments: [path.join(notesLocation, entry.name)]
                        });
                  }

                  return { note, time: fs.statSync(note.fullPath).mtime.getTime() };
                })
              // Sort: folders first, then notes alphabetically
              .sort((a, b) => {
                  if (a.note.isFolder && !b.note.isFolder) {
                      return -1;
                  }

                  if (!a.note.isFolder && b.note.isFolder) {
                      return 1;
                  }

                  // Sort descending newest to oldest
                  const timeDelta = b.time - a.time;

                  if (timeDelta !== 0) {
                    return timeDelta;
                  }

                  return a.note.name.localeCompare(b.note.name);
              })
              .map(({ note }) => note);

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
