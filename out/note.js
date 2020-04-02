"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
class Note extends vscode.TreeItem {
    constructor(label, location, collapsibleState, command) {
        super(label);
        this.label = label;
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
        return `${this.label}`;
    }
}
exports.Note = Note;
//# sourceMappingURL=note.js.map