"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
class NotesCommon {
    openNote(notePath) {
        console.log('"vscode-notes" openNote open note.');
        return vscode.workspace.openTextDocument(notePath).then(note => {
            return vscode.window.showTextDocument(note);
        });
    }
}
exports.NotesCommon = NotesCommon;
//# sourceMappingURL=notesCommon.js.map