import * as vscode from 'vscode';
import { Note } from './note';

// the same type in both views, so notes can be dragged between Workspace Notes and Notes
const NOTES_MIME_TYPE = 'application/vnd.notes.items';

// what a move needs to know about a note or folder; a drag carries it as text, since only drops
// within the same view keep the original objects
export interface MovableItem {
	name: string;
	fullPath: string;
	isFolder: boolean;
}

// drag notes and folders onto a folder, or onto empty space for the top level, to move them
export class NotesDragAndDrop implements vscode.TreeDragAndDropController<Note> {

	readonly dragMimeTypes = [NOTES_MIME_TYPE, 'text/uri-list'];
	readonly dropMimeTypes = [NOTES_MIME_TYPE];

	constructor(
		// the top level folder of this view, '' when it has none
		private root: () => string,
		private move: (items: readonly MovableItem[], targetFolder: string) => Thenable<void>) {
	}

	handleDrag(source: readonly Note[], dataTransfer: vscode.DataTransfer): void {
		const items: MovableItem[] = source.map(({ name, fullPath, isFolder }) => ({ name, fullPath, isFolder }));
		dataTransfer.set(NOTES_MIME_TYPE, new vscode.DataTransferItem(JSON.stringify(items)));
		// dropped on the editor area, the notes open
		const uris = source.filter(item => !item.isFolder).map(item => vscode.Uri.file(item.fullPath).toString());
		if (uris.length) {
			dataTransfer.set('text/uri-list', new vscode.DataTransferItem(uris.join('\r\n')));
		}
	}

	async handleDrop(target: Note | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
		const items = await readItems(dataTransfer);
		// dropped on a note, it goes next to the note
		const targetFolder = target ? (target.isFolder ? target.fullPath : target.location) : this.root();
		if (items?.length && targetFolder) {
			await this.move(items, targetFolder);
		}
	}
}

// the dragged items; dropped on the other view the type arrives twice, once empty, so use the entry that has them
async function readItems(dataTransfer: vscode.DataTransfer): Promise<MovableItem[] | undefined> {
	const values: Thenable<string>[] = [];
	dataTransfer.forEach((item, mimeType) => {
		if (mimeType === NOTES_MIME_TYPE) {
			values.push(item.asString());
		}
	});
	const data = (await Promise.all(values)).find(value => value.length > 0);
	return data ? JSON.parse(data) : undefined;
}
