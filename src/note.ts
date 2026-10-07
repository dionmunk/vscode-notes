import * as vscode from 'vscode';
import * as path from 'path';

export class Note extends vscode.TreeItem {
	public readonly isFolder: boolean;
	public readonly fullPath: string;

	constructor(
		public readonly name: string,
		public readonly location: string,
		public readonly isDirectory: boolean = false,
		public readonly command?: vscode.Command
	) {
		super(name, isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
		this.name = name;
		this.location = location;
		this.isFolder = isDirectory;
		this.fullPath = path.join(location, name);

		// the file icon theme picks the icon from the resource, by extension for a note and by name for a folder
		this.resourceUri = vscode.Uri.file(this.fullPath);
		this.iconPath = isDirectory ? vscode.ThemeIcon.Folder : vscode.ThemeIcon.File;

		// Set contextValue based on whether this is a folder or note
		this.contextValue = isDirectory ? 'folder' : 'note';
	}

	tooltip = this.name;
}
