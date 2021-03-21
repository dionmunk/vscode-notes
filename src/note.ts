import * as vscode from 'vscode';
import * as path from 'path';

export class Note extends vscode.TreeItem {

	constructor(
		public readonly name: string,
		public readonly location: string,
		public readonly category: string,
		public readonly tags: string,
		public readonly command?: vscode.Command
	) {
		super(name);
		this.name = name;
		this.location = location;
		this.category = category;
		this.tags = tags;
		this.iconPath = {
			light: path.join(__filename, '..', '..', 'resources', 'light', 'note.svg'),
			dark: path.join(__filename, '..', '..', 'resources', 'dark', 'note.svg')
		};
	}

	get tooltip(): string {
		return `${this.name}`;
	}

	contextValue = 'note';
}