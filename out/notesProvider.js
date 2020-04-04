"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const fs = require("fs");
const gl = require("glob");
const path = require("path");
const note_1 = require("./note");
class NotesProvider {
    // assign notes location passed to NotesProvider
    constructor(notesLocation) {
        this.notesLocation = notesLocation;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    ;
    init() {
        this.refresh();
        return this;
    }
    // refresh tree if tree data changed
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    // get TreeItem representation of a note
    getTreeItem(note) {
        return note;
    }
    // get children from notes location
    getChildren(note) {
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
    getNotes(notesLocation) {
        // if the notes location exists
        if (this.pathExists(notesLocation)) {
            // create a list of Notes called listOfNotes
            const listOfNotes = (note) => {
                // return a Note, when a note is clicked on in the view, perform a command
                return new note_1.Note(path.basename(note), notesLocation, vscode.TreeItemCollapsibleState.None, {
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
    pathExists(p) {
        // try accessing the given location
        try {
            fs.accessSync(p);
            // error if we can't access given location
        }
        catch (err) {
            // return false if location does not exist
            return false;
        }
        // return true if location exists
        return true;
    }
}
exports.NotesProvider = NotesProvider;
//# sourceMappingURL=notesProvider.js.map