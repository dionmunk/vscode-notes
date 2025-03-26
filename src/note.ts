import * as vscode from 'vscode';
import * as path from 'path';

export class Note extends vscode.TreeItem {
	public readonly isFolder: boolean;
	public readonly fullPath: string;

	constructor(
		public readonly name: string,
		public readonly location: string,
		public readonly category: string,
		public readonly tags: string,
		public readonly isDirectory: boolean = false,
		public readonly command?: vscode.Command
	) {
		super(name, isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
		this.name = name;
		this.location = location;
		this.category = category;
		this.tags = tags;
		this.isFolder = isDirectory;
		this.fullPath = path.join(location, name);

		// Set appropriate icon based on whether this is a folder or file
		if (isDirectory) {
			// Use VS Code's built-in folder icons
			this.iconPath = new vscode.ThemeIcon('folder');
		} else {
			// Use VS Code's built-in file type icons based on extension
			this.iconPath = vscode.ThemeIcon.File;
		}

		// Set contextValue based on whether this is a folder or note
		this.contextValue = isDirectory ? 'folder' : 'note';
	}

	tooltip = this.name;
}
