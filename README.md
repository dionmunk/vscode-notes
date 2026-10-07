# Notes

[![Creative Commons](https://flat.badgen.net/badge/license/CC-BY-NC-4.0/orange)](https://creativecommons.org/licenses/by-nc/4.0/)
[![GitHub](https://flat.badgen.net/github/release/dionmunk/vscode-notes/)](https://github.com/dionmunk/vscode-notes/releases)
[![Visual Studio Marketplace](https://vsmarketplacebadges.dev/installs/dionmunk.vscode-notes.png?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=dionmunk.vscode-notes)

Notes is a Markdown focused notes extension for Visual Studio Code that takes inspiration from Notational Velocity and nvAlt.

![Notes Demo](/screenshots/screenshot.png?raw=true "Notes Demo")

## Features

Notes are stored in a single location (directory) located anywhere on your system you'd like. This allows you to store notes locally or inside a cloud service like Dropbox, iCloud Drive, Google Drive, OneDrive, etc. Notes are written in Markdown and are stored as **.md** by default, but you can change this to whatever you want. It's recommended to name your notes with a file extension, like **.md**, or VS Code won't know how to render your note correctly.

The extension can be accessed using the Notes icon that is placed in the Activity Bar, or in the Command Pallet (CMD+Shift+P or CTRL+Shift+P) by typing `Notes`.

* quickly create new notes by using the `Alt+N` shortcut, or by click on the `+` icon at the top when you are in Notes.
* quickly access your list of notes by using the `Alt+L` shortcut to bring up a searchable list at the top of VSCode.
* search inside your notes with **Notes: Search Notes**, the search button at the top of each section, or **Search in Folder** in the right-click menu of a folder. It opens VS Code's Search view limited to your notes, wherever they are stored.
* hovering over a note inside Notes displays two icons, one allows you to rename a note and the other allows you to delete a note. *Deleting a note is permanent, so be careful.*
* move notes and folders by dragging them onto a folder (or onto empty space for the top level), between Workspace Notes and Notes, or with **Move To...** in the right-click menu. Select several with `Cmd`/`Ctrl` to move them together, and drag a note onto the editor to open it.

## Getting Started

Notes will prompt you for a storage location the first time you access the extension from the Activity Bar or through the Command Pallet. If you would like to change the storage location, later on, you can access the Notes extension settings by clicking on the gear icon in Notes or from the Command Pallet. After you've selected a storage location, you can access your notes from the Notes icon in the Activity Bar, or through the Command Pallet.

## Workspace Notes

Notes for a single project can live with that project. When the open workspace has notes, a **Workspace Notes** section is shown above **Notes**, the same way the Explorer shows Outline and Timeline below the files. Notes keeps showing the notes from your user settings in every window.

* run **Notes: Set Up Workspace Notes** (also in the `...` menu of Notes) to create a `.notes` folder in the workspace and use it for its notes, or **Notes: Select Workspace Notes Location** to pick another folder
* the location is saved in the workspace settings, relative to the workspace folder when it is inside it, so it works for anyone who opens the project
* to give every project that has a `.notes` folder its own notes, set `notes.workspaceNotesLocation` to `.notes` in your user settings instead
* the New Note and New Folder buttons of each section create in that section, and **Notes: New Note** (`Alt+N`) asks which one to use when both are available
* add `.notes` to the project's `.gitignore` if the notes are only for you

A multi-root workspace uses the first folder for relative locations.

## Extension Settings

This extension contributes the following settings:

* `Notes.notesLocation`: location of the notes in the Notes section, set in your user settings and not synced between machines. In a [portable](https://code.visualstudio.com/docs/editor/portable) VS Code, a relative path is relative to the folder holding VS Code, so the notes can travel with it (for example `data/Notes` on Windows and Linux)
* `Notes.workspaceNotesLocation`: location of the notes in the Workspace Notes section, relative to the workspace folder or a full path
* `Notes.notesDefaultNotesExtension`: extension used for new notes
* `Notes.notesExtensions`: list of extensions recognized as notes or '*' for all extensions
* `Notes.watchExternalChanges`: update the Notes view when notes are added, renamed or removed outside of VS Code
* `Notes.watchIntervalSeconds`: how often the open folders are checked for those changes while the Notes view is visible

## Future Plans

* custom Notes editor with shortcuts for common Markdown functions (bold, italic, link, code block, etc.)
* option to have an automatic Markdown preview pop up when you start editing a note
* search notes in the Notes view using note name and contents
* allow for front matter in Notes like tags and categories (with possible tree structure based on tags and categories)
* allow for multiple Notes' storage locations and make them switchable

## License

This work is licensed under a [Creative Commons Attribution-NonCommercial 4.0 International License](https://creativecommons.org/licenses/by-nc/4.0/).
