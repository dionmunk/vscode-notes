# Change Log

All notable changes to the "vscode-notes" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.1.0] - 2026-10-07

### Added

* `Notes: Select Storage Location` command
* the storage location can start with `~` for your home folder, or be relative to the workspace folder
* the Notes view updates on its own when notes are added, renamed or removed outside of the window, by a sync client or another editor for example (`notes.watchExternalChanges`, `notes.watchIntervalSeconds`)
* `Reveal in File Explorer` for a note, a folder or the storage location, including from WSL
* a Workspace Notes section above Notes for the notes of the open workspace, shown when the workspace has notes (#4), with the new `notes.workspaceNotesLocation` setting and the `Notes: Set Up Workspace Notes` and `Notes: Select Workspace Notes Location` commands
* `Notes: New Note` and `Notes: New Folder` ask whether to use Workspace Notes or Notes when both are available
* a Create Folder button when a storage location is set but its folder doesn't exist
* move notes and folders by dragging them onto a folder, onto empty space for the top level, or between Workspace Notes and Notes, or with `Move To...` in the right-click menu; open notes stay open at their new location, and several selected items move together
* drag a note onto the editor area to open it
* `Notes: List Notes` (`Alt+L`) offers to create a note with the name you typed when it isn't a note yet, so `Enter` creates it when nothing matches, in either section when the workspace has notes (#34)
* search inside your notes with VS Code's search: `Notes: Search Notes` covers Workspace Notes and Notes, the search button of each section covers that section, and `Search in Folder` in the right-click menu of a folder covers that folder, even when the notes are outside the workspace (#17)
* notes and folders use the icons of your file icon theme
* a new note keeps an extension typed with its name, like `query.sql` or `data.json`, when VS Code knows a language for it (or it is in `notes.notesExtensions`), otherwise it gets the default extension (#81)

### Changed

* a new storage location or list of extensions is used right away, a window reload is no longer required
* the Notes view explains why it is empty: no storage location, a storage location that can't be found, or no notes yet
* `notes.notesLocation` is no longer synced between machines (#26), and the Notes section only uses the value in your user settings
* a `notes.notesLocation` set in a workspace's settings is now shown as that workspace's Workspace Notes, and is replaced by `notes.workspaceNotesLocation` when a workspace notes location is selected
* `Notes: List Notes` lists the notes of both sections, including those in folders, and only lists files
* only Markdown notes start with their name as a heading, other new notes start empty

### Fixed

* the Notes view kept asking for a storage location after one was set (#69, #71)
* a storage location selected while the workspace settings had one was saved but never used
* new notes and folders were created in the extension's working folder when no storage location was set
* the Notes view is refreshed after a note or folder has been created, instead of before
* the Notes view is refreshed after a note has been deleted, instead of before
* deleting a folder relied on a package that was only installed as a development dependency
* New Note and New Folder failed when a note was selected, they now create next to the note (#67, #76)
* in a portable VS Code, a relative storage location is relative to the folder holding VS Code, so notes can be kept with it and opened from there (#38)
* renaming a note to another extension, like `a.txt`, failed with "already exists" when all extensions were allowed, and a name with dots like `Meeting 2026.10.07` lost its last part
* Rename and Delete no longer appear in the command palette, where they had no note or folder to act on

## [2.0.0] - 2025-03-26

### Added

* directory support

### Changed

* note filetype support
* setup functionality
* icons

## [1.2.1] - 2023-12-28

### Added

* new sidebar icon

## [1.2.0] - 2023-12-27

### Added

* new Notes.notesDefaultNotesExtension setting to set extension of new notes. The default is `md`.
* new Notes.notesExtensions setting to allow Notes to detect different file types when generating a list of notes. Must be a comma separated list of file extensions eg: `md,markdown,txt` etc. The default is `md,markdown,txt`.

### Fixed

* Updated packages and requirements to latest versions.

## [1.1.0] - 2020-04-04

### Added

* activity bar icon
* view list of notes in selected location
* icon to create a new note
* rename a note
* delete a note

### Changed

* build extension using webpack to minify

## [1.0.0] - 2020-03-26

### Added

* set notes location
* create a new note
* list new notes

[Unreleased]: https://github.com/dionmunk/vscode-notes/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/dionmunk/vscode-notes/compare/v1.2.1...v2.0.0
[1.2.1]: https://github.com/dionmunk/vscode-notes/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/dionmunk/vscode-notes/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/dionmunk/vscode-notes/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/dionmunk/vscode-notes/compare/v1.0.0
