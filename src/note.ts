import * as vscode from 'vscode';
import * as path from 'path';

export class Note extends vscode.TreeItem {

	constructor(
		public readonly name: string,
		public readonly location: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(name);
	}

	get tooltip(): string {
		return `${this.name}`;
	}

	iconPath = {
		light: path.join(__filename, '..', '..', 'resources', 'light', 'note.svg'),
		dark: path.join(__filename, '..', '..', 'resources', 'dark', 'note.svg')
	};

	contextValue = 'note';
}