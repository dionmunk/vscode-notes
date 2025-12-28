import * as vscode from 'vscode';
import LabelId, { ANY_LABEL_ID, NONE_LABEL_ID } from './LabelId';

export default abstract class Label extends vscode.TreeItem {
	public abstract command: vscode.Command;

	constructor(public readonly label: string, hasChildren: boolean) {
		super(label, hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
	}
}

export class NoteLabel extends Label {

	public static TAG_GROUP_SEP = "/";

	public readonly command: vscode.Command;

	public readonly id = this.ancestors.concat(this.name).join(NoteLabel.TAG_GROUP_SEP);

	constructor(public readonly name: string, public readonly ancestors: string[], public readonly usingFilePaths: string[], public readonly children: Label[]) {
		const itemLabel = (ancestors.length == 0 ? "#" : "") + name + " (" + usingFilePaths.length + ")";

		super(itemLabel, children.length > 0);

		this.command = {
			command: 'Notes.filterNotes',
			title: 'Show notes with this tag',
			arguments: [ this.id ]
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