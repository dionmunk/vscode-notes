"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const fs = require("fs");
const gl = require("glob");
const path = require("path");
const note_1 = require("./note");
class NotesProvider {
    constructor(storageLocation) {
        this.storageLocation = storageLocation;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        console.log('"vscode-notes" storage location: ' + storageLocation);
    }
    ;
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        var treeItem = new vscode.TreeItem(element.label);
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
    getChildren(element) {
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
    getNotes(notePath) {
        // if the storage location exists
        if (this.pathExists(notePath)) {
            // create a list of Notes called listOfNotes
            const listOfNotes = (item) => {
                return new note_1.Note(path.basename(item), notePath, vscode.TreeItemCollapsibleState.None);
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
    pathExists(p) {
        console.log('"vscode-notes" checking if path exists.');
        try {
            fs.accessSync(p);
        }
        catch (err) {
            console.log('"vscode-notes" path does not exist.');
            return false;
        }
        console.log('"vscode-notes" path exists.');
        return true;
    }
}
exports.NotesProvider = NotesProvider;
//# sourceMappingURL=notesProvider.js.map