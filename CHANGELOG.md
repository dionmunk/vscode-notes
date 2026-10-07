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

### Changed

* a new storage location or list of extensions is used right away, a window reload is no longer required
* the Notes view explains why it is empty: no storage location, a storage location that can't be found, or no notes yet

### Fixed

* the Notes view kept asking for a storage location after one was set (#69, #71)
* a storage location selected while the workspace settings had one was saved but never used
* new notes and folders were created in the extension's working folder when no storage location was set
* the Notes view is refreshed after a note or folder has been created, instead of before
* the Notes view is refreshed after a note has been deleted, instead of before
* deleting a folder relied on a package that was only installed as a development dependency

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
