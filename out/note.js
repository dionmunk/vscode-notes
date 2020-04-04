"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
class Note extends vscode.TreeItem {
    constructor(name, location, collapsibleState, command) {
        super(name);
        this.name = name;
        this.location = location;
        this.collapsibleState = collapsibleState;
        this.command = command;
        this.iconPath = {
            light: path.join(__filename, '..', '..', 'resources', 'light', 'note.svg'),
            dark: path.join(__filename, '..', '..', 'resources', 'dark', 'note.svg')
        };
        this.contextValue = 'note';
    }
    get tooltip() {
        return `${this.name}`;
    }
}
exports.Note = Note;
//# sourceMappingURL=note.js.map