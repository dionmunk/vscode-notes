import * as vscode from 'vscode';
import { ANY_LABEL_ID, NONE_LABEL_ID } from './LabelId';

export default abstract class Label extends vscode.TreeItem {
	public abstract command: vscode.Command;

	constructor(public readonly label: string, hasChildren: boolean) {
		super(label, hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
	}
}

export class NoteLabel extends Label {
	public readonly command: vscode.Command;

	constructor(public readonly name: string, public readonly ancestors: string[], public readonly usingFilePaths: string[], public readonly children: Label[]) {
		const label = (ancestors.length == 0 ? "#" : "") + name + " (" + usingFilePaths.length + ")";

		super(label, children.length > 0);

		this.command = {
			command: 'Notes.filterNotes',
			title: 'Show notes with this tag',
			arguments: [{ name, ancestors }]
		};
	}
}

export class AnyLabel extends Label {
	public static INSTANCE = new AnyLabel();

	public readonly command: vscode.Command;

	private constructor() {
		super("<Any>", false);

		this.command = {
			command: 'Notes.filterNotes',
			title: 'Show all notes',
			arguments: [ ANY_LABEL_ID ]
		};
	}
}

export class NoneLabel extends Label {
	public readonly command: vscode.Command;

	constructor(public readonly usingFilePaths: string[]) {
		super("<None> (" + usingFilePaths.length + ")", false);

		this.command = {
			command: 'Notes.filterNotes',
			title: 'Show notes without any tags',
			arguments: [ NONE_LABEL_ID ]
		};
	}
}