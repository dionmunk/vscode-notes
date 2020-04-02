import * as vscode from 'vscode';

export class NotesCommon {

    openNote(notePath: string): Thenable<vscode.TextEditor> {
        console.log('"vscode-notes" openNote open note.');
        return vscode.workspace.openTextDocument(notePath).then(note => {
            return vscode.window.showTextDocument(note);
        });
    }

}