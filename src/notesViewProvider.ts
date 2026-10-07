import * as vscode from 'vscode';
import * as fs from 'fs';
import * as gl from 'glob';
import * as path from 'path';
import { Note } from './note';
import { LocationState, getLocationState } from './location';

export class NotesViewProvider implements vscode.TreeDataProvider<Note> {

    private _onDidChangeTreeData: vscode.EventEmitter<Note | undefined> = new vscode.EventEmitter<Note | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Note | undefined> = this._onDidChangeTreeData.event;
    private folderMap: Map<string, Note[]> = new Map<string, Note[]>();
    private locationState: LocationState | undefined;
    // what each folder on screen held when the tree last read it, to tell when it changed on disk
    private shownFolders: Map<string, string> = new Map<string, string>();

    // constructor for NotesViewProvider
    constructor(
        private notesLocation: string,
        private notesExtensions: string,
        // context key for the state of this tree's location, which picks the welcome content of its view
        private stateContextKey: string = 'notes.locationState') {
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

    // use a new storage location or list of extensions without reloading the window
    update(notesLocation: string, notesExtensions: string): void {
        this.notesLocation = notesLocation;
        this.notesExtensions = notesExtensions;
        this.shownFolders.clear();
        this.refresh();
    }

    // a collapsed folder shows nothing, so a change inside it (or inside its subfolders) does not need a refresh
    forgetFolder(folderPath: string): void {
        for (const folder of [...this.shownFolders.keys()]) {
            if (folder === folderPath || folder.startsWith(folderPath + path.sep)) {
                this.shownFolders.delete(folder);
            }
        }
    }

    // has anything the tree shows been added, renamed or removed on disk since it was read?
    // edits to a note do not count, the tree only shows names
    async hasExternalChanges(): Promise<boolean> {
        // the storage location itself appeared or disappeared
        const ready = getLocationState(this.notesLocation) === 'ready';
        if (ready !== (this.locationState === 'ready' || this.locationState === 'empty')) {
            return true;
        }

        for (const [folder, shown] of [...this.shownFolders]) {
            let current: string;
            try {
                current = folderSignature(await fs.promises.readdir(folder, { withFileTypes: true }));
            } catch (err) {
                // the folder is gone, its parent's listing shows that
                this.shownFolders.delete(folder);
                continue;
            }
            if (current !== shown) {
                return true;
            }
        }
        return false;
    }

    // the location this tree shows
    get location(): string {
        return this.notesLocation;
    }

    // set the location state context key, which picks the welcome content shown in an empty view
    private setLocationState(state: LocationState): void {
        if (state !== this.locationState) {
            this.locationState = state;
            vscode.commands.executeCommand('setContext', this.stateContextKey, state);
        }
    }

    // get the parent of a note
    getTreeItem(note: Note): vscode.TreeItem {
        return note;
    }

    // get the children of a note
    getChildren(note?: Note): Thenable<Note[]> {
        // if there is no usable notes location return an empty list
        const state = getLocationState(this.notesLocation);
        if (state !== 'ready') {
            this.setLocationState(state);
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
            const notes = this.getNotes(this.notesLocation, this.notesExtensions);
            this.setLocationState(notes.length ? 'ready' : 'empty');
            return Promise.resolve(notes);
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
                this.shownFolders.set(notesLocation, folderSignature(items));

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

// names and types of the entries in a folder, every entry is included so nothing the tree shows can be missed
function folderSignature(items: fs.Dirent[]): string {
    return items
        .map(item => (item.isDirectory() ? 'd:' : 'f:') + item.name)
        .sort()
        .join('\n');
}
