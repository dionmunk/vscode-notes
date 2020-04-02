"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const notesProvider_1 = require("./notesProvider");
// activate extension
function activate(context) {
    console.log('"vscode-notes" is active.');
    /*
    * list
    * displays notes in storage location, opens selected note
    */
    let listNotesDisposable = vscode.commands.registerCommand('Notes.list', () => {
        console.log('"vscode-notes" listing notes.');
        // get Notes storage location
        let extensionConf = vscode.workspace.getConfiguration('Notes');
        let notesFolder = extensionConf.get('notesFolder');
        // read files in storage location
        fs.readdir(String(notesFolder), (err, files) => {
            if (err) {
                // report error
                console.error(err);
                return vscode.window.showErrorMessage('Failed to read the notes folder.');
            }
            else {
                // show list of notes
                vscode.window.showQuickPick(files).then(file => {
                    // open selected note
                    vscode.window.showTextDocument(vscode.Uri.file(path.join(String(notesFolder), String(file))));
                });
            }
        });
    });
    context.subscriptions.push(listNotesDisposable);
    /*
    * new
    * displays input box, asks for a note title, opens a new note
    */
    let newNoteDisposable = vscode.commands.registerCommand('Notes.new', () => {
        console.log('"vscode-notes" creating new note.');
        vscode.window.showInputBox({
            prompt: 'Note title?',
            value: '',
        }).then(noteTitle => {
            // get Notes storage location
            let extensionConf = vscode.workspace.getConfiguration('Notes');
            let notesFolder = extensionConf.get('notesFolder');
            // set note title
            let fileName = `${noteTitle}`;
            // set note path
            let filePath = path.join(String(notesFolder), `${fileName.replace(/\:/gi, '')}.md`);
            // set note first line
            let firstLine = "# " + fileName + "\n\n";
            // does note exist already?
            let noteExists = fs.existsSync(String(filePath));
            // if user entered title then create new note
            if (noteTitle) {
                // if a note with title doesn't already exist
                if (!noteExists) {
                    // try writing the file to the storage location
                    fs.writeFile(filePath, firstLine, err => {
                        if (err) {
                            // report error
                            console.error(err);
                            return vscode.window.showErrorMessage('Failed to create the new note.');
                        }
                        else {
                            // open file
                            let file = vscode.Uri.file(filePath);
                            vscode.window.showTextDocument(file).then(() => {
                                // go to last line in new file
                                vscode.commands.executeCommand('cursorMove', { 'to': 'viewPortBottom' });
                            });
                        }
                    });
                }
                else {
                    // report error
                    return vscode.window.showErrorMessage('A note with that name already exists.');
                }
            }
        });
    });
    context.subscriptions.push(newNoteDisposable);
    /*
    * setup
    * display dialog to allow user to select note storage location
    */
    let setupNotesDisposable = vscode.commands.registerCommand('Notes.setup', () => {
        console.log('"vscode-notes" setting up notes.');
        // dialog options
        let openDialogOptions = {
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select'
        };
        // display dialog with options
        vscode.window.showOpenDialog(openDialogOptions).then(fileUri => {
            if (fileUri && fileUri[0]) {
                // get Notes configuration
                let extensionConf = vscode.workspace.getConfiguration('Notes');
                // update Notes configuration with selected location
                extensionConf.update('notesFolder', path.normalize(fileUri[0].fsPath), true).then(() => {
                    console.log('"vscode-notes" updating notes storage location.');
                    // tell user the location was selected
                    vscode.window.showInformationMessage('You selected a location to store notes.');
                });
            }
        });
    });
    context.subscriptions.push(setupNotesDisposable);
    /*
    * tree view
    */
    let notesFolder = vscode.workspace.getConfiguration('Notes').get('notesFolder');
    vscode.window.registerTreeDataProvider('notes', new notesProvider_1.NotesProvider(String(notesFolder)));
    vscode.commands.registerCommand('Notes.refresh', () => {
        notesProvider_1.NotesProvider.refresh();
    });
    // vscode.commands.registerCommand('Notes.refresh', (note: Note) => vscode.window.showInformationMessage(`Successfully called refresh.`));
    vscode.commands.registerCommand('Notes.delete ', (note) => vscode.window.showInformationMessage(`Successfully deleted ${note.label}.`));
}
exports.activate = activate;
;
// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map