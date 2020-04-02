"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
class NotesProvider {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No notes in storage location');
            return Promise.resolve([]);
        }
        if (element) {
            return Promise.resolve(this.getNotesInLocation(path.join(this.workspaceRoot, element.name)));
        }
        else {
            return Promise.resolve([]);
        }
        /*
        if (element) {
            return Promise.resolve([]);
        }
        else {
            return Promise.resolve(this.getNotesInLocation(''));
        }
        */
    }
    /**
     * Given the storage location find all notes in location
     */
    getNotesInLocation(notesLocation) {
        if (this.pathExists(notesLocation)) {
            return new Note(name, command);
        }
        else {
            return [];
        }
    }
    /**
     * Given the storage location find all notes in location
     */
    getNotesInLocation1(notesLocation) {
        if (this.pathExists(notesLocation)) {
            const toDep = (moduleName, version) => {
                if (this.pathExists(path.join(this.workspaceRoot, 'node_modules', moduleName))) {
                    return new Note(moduleName, version, vscode.TreeItemCollapsibleState.Collapsed);
                }
                else {
                    return new Note(moduleName, version, vscode.TreeItemCollapsibleState.None, {
                        command: 'extension.openPackageOnNpm',
                        title: '',
                        arguments: [moduleName]
                    });
                }
            };
            const deps = packageJson.dependencies
                ? Object.keys(packageJson.dependencies).map(dep => toDep(dep, packageJson.dependencies[dep]))
                : [];
            const devDeps = packageJson.devDependencies
                ? Object.keys(packageJson.devDependencies).map(dep => toDep(dep, packageJson.devDependencies[dep]))
                : [];
            return deps.concat(devDeps);
        }
        else {
            return [];
        }
    }
    pathExists(p) {
        try {
            fs.accessSync(p);
        }
        catch (err) {
            return false;
        }
        return true;
    }
}
exports.NotesProvider = NotesProvider;
class Note extends vscode.TreeItem {
    constructor(name, command) {
        super(name);
        this.name = name;
        this.command = command;
        this.iconPath = {
            light: path.join(__filename, '..', '..', 'resources', 'light', 'note.svg'),
            dark: path.join(__filename, '..', '..', 'resources', 'dark', 'note.svg')
        };
        this.contextValue = 'note';
    }
    get tooltip() {
        return `${this.name}`;
    }
}
exports.Note = Note;
//# sourceMappingURL=notesProvider1.js.map