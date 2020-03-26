const vscode = require('vscode');
const fs = require('fs')
const path = require('path')

/**
 * @param {vscode.ExtensionContext} context
 */

// method to activate extension
function activate(context) {

	console.log('Notes is active.');

  // Notes setup
	let runSetupDisposable = vscode.commands.registerCommand('Notes.setup', function () {

    const options = vscode.OpenDialogOptions = {
      canSelectFile: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select',
    }

    vscode.window.showOpenDialog(options).then(fileUri => {
      if(fileUri && fileUri[0]) {
        const extensionConf = vscode.workspace.getConfiguration('notes')
        extensionConf.update('notesFolder', path.normalize(fileUri[0].fsPath), true).then(() => {
          vscode.window.showInformationMessage('Where do you want to save notes?')
        }).catch(err => {
          console.error(err)
          vscode.window.showErrorMessage('An error occurred during setup.')
        })
      }
    })
	});

  context.subscriptions.push(runSetupDisposable);

  // Notes new
  let newNoteDisposable = vscode.commands.registerCommand('Notes.new', function () {
    vscode.window.showInputBox({
      prompt: 'Note title?',
      value: '',
    }).then(noteTitle => {
      const extensionConf = vscode.workspace.getConfiguration('notes')
      const notesFolder = extensionConf.get('notesFolder')
      const title = `${noteTitle}`
      // remove bad characters from title / will need to expand this eventually
      const filePath = path.join(notesFolder, `${title.replace(/\:/gi, '')}.md`)
      // if the user entered a title for the note then create a new one, otherwise do nothing
      if(noteTitle) {
        fs.writeFile(filePath, title, err => {
          if(err) {
            console.error(err)
            return vscode.window.showErrorMessage('Failed to create the new note.')
          }
          vscode.window.showTextDocument(vscode.Uri.file(filePath)).then(() => {
          }).catch(console.error)
        })
      }
    })
  })

  context.subscriptions.push(newNoteDisposable);

  // Notes list
  let listNotesDisposable = vscode.commands.registerCommand('Notes.list', function () {
      const extensionConf = vscode.workspace.getConfiguration('notes')
      const notesFolder = extensionConf.get('notesFolder')
      fs.readdir(notesFolder, function(err, files) {
        if(err) {
          return vscode.window.showErrorMessage('Failed to read the notes folder.')
        }
        vscode.window.showQuickPick(files).then(file => {
          vscode.window.showTextDocument(vscode.Uri.file(path.join(notesFolder, file))).then(() => {
          }).catch(console.error)
        })
      })
  })

  context.subscriptions.push(listNotesDisposable)
}
exports.activate = activate;

// method to deactivate extension
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
