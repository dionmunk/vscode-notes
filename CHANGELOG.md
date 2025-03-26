# Change Log

All notable changes to the "vscode-notes" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/dionmunk/vscode-notes/compare/v1.2.1...HEAD
[1.2.1]: https://github.com/dionmunk/vscode-notes/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/dionmunk/vscode-notes/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/dionmunk/vscode-notes/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/dionmunk/vscode-notes/compare/v1.0.0
