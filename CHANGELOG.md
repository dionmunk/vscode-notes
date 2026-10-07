# Change Log

All notable changes to the "vscode-notes" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
* notes and folders use the icons of your file icon theme

### Changed

* a new storage location or list of extensions is used right away, a window reload is no longer required
* the Notes view explains why it is empty: no storage location, a storage location that can't be found, or no notes yet
* `notes.notesLocation` is no longer synced between machines (#26), and the Notes section only uses the value in your user settings
* a `notes.notesLocation` set in a workspace's settings is now shown as that workspace's Workspace Notes, and is replaced by `notes.workspaceNotesLocation` when a workspace notes location is selected
* `Notes: List Notes` lists the notes of both sections and only lists files

### Fixed

* the Notes view kept asking for a storage location after one was set (#69, #71)
* a storage location selected while the workspace settings had one was saved but never used
* new notes and folders were created in the extension's working folder when no storage location was set
* the Notes view is refreshed after a note or folder has been created, instead of before
* the Notes view is refreshed after a note has been deleted, instead of before
* deleting a folder relied on a package that was only installed as a development dependency
* New Note and New Folder failed when a note was selected, they now create next to the note (#67, #76)
* in a portable VS Code, a relative storage location is relative to the folder holding VS Code, so notes can be kept with it and opened from there (#38)

## [2.0.0] - 2025-03-26

### Added

* directory support

## changed

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
