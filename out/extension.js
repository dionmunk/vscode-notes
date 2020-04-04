"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// figure out how to reload treeview when notes location changes
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const notesProvider_1 = require("./notesProvider");
let extId = 'vscode-notes';
// activate extension
function activate(context) {
    console.log('"vscode-notes" is active.');
    // register tree view provider
    let notesTree = new notesProvider_1.NotesProvider(String(Notes.getNotesLocation()));
    vscode.window.registerTreeDataProvider('notes', notesTree.init());
    // prompt user to select a storage location
    if (!Notes.getNotesLocation()) {
        vscode.window.showWarningMessage(`You need to select a notes storage location before you can start using Notes.`, 'Select', 'Cancel').then(result => {
            // if the user answers Select
            if (result === 'Select') {
                Notes.setupNotes();
            }
        });
        return;
    }
    /*
    * register commands
    */
    // delete note
    let deleteNoteDisposable = vscode.commands.registerCommand('Notes.deleteNote', (note) => {
        Notes.deleteNote(note, notesTree);
    });
    context.subscriptions.push(deleteNoteDisposable);
    // list notes
    let listNotesDisposable = vscode.commands.registerCommand('Notes.listNotes', () => {
        Notes.listNotes();
    });
    context.subscriptions.push(listNotesDisposable);
    // new note
    let newNoteDisposable = vscode.commands.registerCommand('Notes.newNote', () => {
        Notes.newNote(notesTree);
    });
    context.subscriptions.push(newNoteDisposable);
    // open note
    let openNoteDisposable = vscode.commands.registerCommand('Notes.openNote', (note) => {
        Notes.openNote(note);
    });
    context.subscriptions.push(openNoteDisposable);
    // refresh notes
    let refreshNotesDisposable = vscode.commands.registerCommand('Notes.refreshNotes', () => {
        Notes.refreshNotes(notesTree);
    });
    context.subscriptions.push(refreshNotesDisposable);
    // rename note
    let renameNoteDisposable = vscode.commands.registerCommand('Notes.renameNote', (note) => {
        Notes.renameNote(note, notesTree);
    });
    context.subscriptions.push(renameNoteDisposable);
    // setup notes
    let setupNotesDisposable = vscode.commands.registerCommand('Notes.setupNotes', () => {
        Notes.setupNotes();
    });
    context.subscriptions.push(setupNotesDisposable);
}
exports.activate = activate;
;
// this method is called when extension is deactivated
function deactivate() {
    /*
    * everything registered in context.subscriptions,
    * so nothing to do here for now
    */
}
exports.deactivate = deactivate;
class Notes {
    constructor(settings) {
        this.settings = settings;
        this.settings = vscode.workspace.getConfiguration(extId);
    }
    // get notes storage location
    static getNotesLocation() {
        return vscode.workspace.getConfiguration('Notes').get('notesLocation');
    }
    // delete note
    static deleteNote(note, tree) {
        // prompt user for confirmation
        vscode.window.showWarningMessage(`Are you sure you want to delete '${note.name}'? This action is permanent and can not be reversed.`, 'Yes', 'No').then(result => {
            // if the user answers Yes
            if (result === 'Yes') {
                // try to delete the note
                fs.unlink(path.join(String(note.location), String(note.name)), (err) => {
                    // if there was an error deleting the note
                    if (err) {
                        // report error
                        console.error(err);
                        return vscode.window.showErrorMessage(`Failed to delete ${note.name}.`);
                    }
                    // else let the user know the file was deleted successfully
                    vscode.window.showInformationMessage(`Successfully deleted ${note.name}.`);
                });
                // refresh tree after deleting note
                tree.refresh();
            }
        });
    }
    // list notes
    static listNotes() {
        let notesLocation = String(Notes.getNotesLocation());
        // read files in storage location
        fs.readdir(String(notesLocation), (err, files) => {
            if (err) {
                // report error
                console.error(err);
                return vscode.window.showErrorMessage('Failed to read the notes folder.');
            }
            else {
                // show list of notes
                vscode.window.showQuickPick(files).then(file => {
                    // open selected note
                    vscode.window.showTextDocument(vscode.Uri.file(path.join(String(notesLocation), String(file))));
                });
            }
        });
    }
    // new note
    static newNote(tree) {
        let notesLocation = String(Notes.getNotesLocation());
        // prompt user for a new note name
        vscode.window.showInputBox({
            prompt: 'Note name?',
            value: '',
        }).then(noteName => {
            // set note name
            let fileName = `${noteName}`;
            // set note path
            let filePath = path.join(String(notesLocation), `${fileName.replace(/\:/gi, '')}.md`);
            // set note first line
            let firstLine = "# " + fileName + "\n\n";
            // does note exist already?
            let noteExists = fs.existsSync(String(filePath));
            // if user entered name then create new note
            if (noteName) {
                // if a note with name doesn't already exist
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
                    // refresh tree after creating new note
                    tree.refresh();
                }
                else {
                    // report
                    return vscode.window.showWarningMessage('A note with that name already exists.');
                }
            }
        });
    }
    // open note
    static openNote(note) {
        let notesLocation = String(Notes.getNotesLocation());
        // open note at location
        vscode.window.showTextDocument(vscode.Uri.file(path.join(String(notesLocation), String(note))));
    }
    // refresh notes
    static refreshNotes(tree) {
        // refresh tree
        tree.refresh();
    }
    // rename note
    static renameNote(note, tree) {
        // prompt user for new note name
        vscode.window.showInputBox({
            prompt: 'New note name?',
            value: note.name
        }).then(noteName => {
            // if no new note name or note name didn't change
            if (!noteName || noteName === note.name) {
                // do nothing
                return;
            }
            // set new not name (may do something special with file types in the future)
            let newNoteName = noteName;
            // check for existing note with the same name
            let newNotePath = path.join(note.location, newNoteName);
            if (fs.existsSync(newNotePath)) {
                vscode.window.showWarningMessage(`'${newNoteName}' already exists.`);
                // do nothing
                return;
            }
            // else save the note
            vscode.window.showInformationMessage(`'${note.name}' renamed to '${newNoteName}'.`);
            fs.renameSync(path.join(note.location, note.name), newNotePath);
            // refresh tree after renaming note
            tree.refresh();
        });
    }
    // setup notes
    static setupNotes() {
        // dialog options
        let openDialogOptions = {
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select'
        };
        // display open dialog with above options
        vscode.window.showOpenDialog(openDialogOptions).then(fileUri => {
            if (fileUri && fileUri[0]) {
                // get Notes configuration
                let notesConfiguration = vscode.workspace.getConfiguration('Notes');
                // update Notes configuration with selected location
                notesConfiguration.update('notesLocation', path.normalize(fileUri[0].fsPath), true).then(() => {
                    // prompt to reload window so storage location change can take effect
                    vscode.window.showWarningMessage(`You must reload the window for the storage location change to take effect.`, 'Reload').then(selectedAction => {
                        // if the user selected to reload the window then reload
                        if (selectedAction === 'Reload') {
                            vscode.commands.executeCommand('workbench.action.reloadWindow');
                        }
                    });
                });
            }
        });
    }
}
exports.Notes = Notes;
//# sourceMappingURL=extension.js.map