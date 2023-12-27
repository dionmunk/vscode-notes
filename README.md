# Notes

[![Creative Commons](https://flat.badgen.net/badge/license/CC-BY-NC-4.0/orange)](https://creativecommons.org/licenses/by-nc/4.0/)
[![GitHub](https://flat.badgen.net/github/release/dionmunk/vscode-notes/)](https://github.com/dionmunk/vscode-notes/releases)
[![Visual Studio Marketplace](https://vsmarketplacebadges.dev/installs/dionmunk.vscode-notes.png?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=dionmunk.vscode-notes)

Notes is a Markdown focused notes extension for Visual Studio Code that takes inspiration from Notational Velocity and nvAlt.

![Notes Demo](/screenshots/screenshot.png?raw=true "Notes Demo")

## Features

Notes are stored in a single location (directory) located anywhere on your system you'd like. This allows you to store notes locally or inside a cloud service like Dropbox, iCloud Drive, Google Drive, OneDrive, etc. Notes are written in Markdown and are stored as **.md** files within the Notes storage directory. You should always name your notes with a **.md** file extension or Notes will not be able to see them. The reason for this is to make sure that Notes are cross-compatible with other Markdown applications.

The extension can be accessed using the Notes icon that is placed in the Activity Bar, or in the Command Pallet (CMD+Shift+P or CTRL+Shift+P) by typing `Notes`.

* quickly create new notes by using the `Alt+N` shortcut, or by click on the `+` icon at the top when you are in Notes.
* quickly access your list of notes by using the `Alt+L` shortcut to bring up a searchable list at the top of VSCode.
* hovering over a note inside Notes displays two icons, one allows you to rename a note and the other allows you to delete a note. *Deleting a note is permanent, so be careful.*

## Getting Started

Notes will prompt you for a storage location the first time you access the extension from the Activity Bar or through the Command Pallet. If you would like to change the storage location, later on, you can access the Notes Setup from the Command Pallet. After you've selected a storage location, you can access your notes from the Notes icon in the Activity Bar, or through the Command Pallet.

## Extension Settings

This extension contributes the following settings:

* `Notes.notesLocation`: location where notes are stored

## Future Plans

* custom Notes editor with shortcuts for common Markdown functions (bold, italic, link, code block, etc.)
* option to have an automatic Markdown preview pop up when you start editing a note
* search notes in the Notes view using note name and contents
* allow for front matter in Notes like tags and categories (with possible tree structure based on tags and categories)
* allow for multiple Notes' storage locations and make them switchable

## License

This work is licensed under a [Creative Commons Attribution-NonCommercial 4.0 International License](https://creativecommons.org/licenses/by-nc/4.0/).
