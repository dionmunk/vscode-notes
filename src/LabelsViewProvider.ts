import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { isBinaryFileSync } from 'isbinaryfile';
import LabelId, { ANY_LABEL_ID, NONE_LABEL_ID, NoteLabelId } from './LabelId';
import Label, { AnyLabel, NoneLabel, NoteLabel } from './Label';
import { NotesViewProvider } from './notesViewProvider';

// TODO: Edit labels updating all referencing files at once.
// TODO: Optimization: Cache the labels index in a metadata file.
// TODO: Add auto-complete to label input
export class LabelsViewProvider implements vscode.TreeDataProvider<Label> {

	private _onDidChangeTreeData: vscode.EventEmitter<Label | undefined> = new vscode.EventEmitter<Label | undefined>();

	readonly onDidChangeTreeData: vscode.Event<Label | undefined> = this._onDidChangeTreeData.event;

	private labels: Label[] | undefined;

	private selectedLabelId: LabelId | undefined;

	private static IS_TAG_LINE_REGEX = /^#[^#\s]+(\s+#[^#\s]+)*$/;

	private static TAG_GLUE_REGEX = /\s+#/;

	constructor(
		private notesLocation: string | undefined,
		private notesExtensions: string | undefined,
		private notesTree: NotesViewProvider) {
	};

	public init(): LabelsViewProvider {
		this.refresh();

		return this;
	}

	refresh(): void {
		this.labels = undefined;
		this._onDidChangeTreeData.fire(undefined);
	}

	setSelectedLabel(labelId: LabelId) {
		this.selectedLabelId = labelId;

		console.debug("Set selected label refreshing filtered notes");
		this.refreshFilteredNotes();
	}

	async renameLabel(oldLabel: NoteLabel, newName: string) {
		if (oldLabel.id === newName) {
			return;
		}

		const trimmedNewName = newName.trim();

		if (/\s/.test(trimmedNewName)) {
			vscode.window.showWarningMessage(`Label name '${trimmedNewName}' cannot contain space characters.`);
		}

		const updatedFiles: string[] = [];

		for await (const usingFilePath of oldLabel.usingFilePaths) {
			// Parse the file in the same way as detection went, so that we don't replace more than we should.
			const detections = await LabelsViewProvider.detectRawLabels(usingFilePath);

			const oldLabelUsingLineIndices = detections
				.filter(({ rawLabels }) => rawLabels.includes(oldLabel.id))
				.map(({ lineIndex }) => lineIndex)

			if (oldLabelUsingLineIndices.length > 0) {
				const content = await fs.promises.readFile(usingFilePath, "utf-8");
				const lineEnding = LabelsViewProvider.detectLineEnding(content);
				const lines = content.split(lineEnding);

				for (const lineIndex of oldLabelUsingLineIndices) {
					lines[lineIndex] = lines[lineIndex].replace(oldLabel.id, trimmedNewName);
				}

				await fs.promises.writeFile(usingFilePath, lines.join(lineEnding), "utf-8");
				updatedFiles.push(usingFilePath);
			}

			vscode.window.showInformationMessage(`Label '${oldLabel.id}' renamed to '${trimmedNewName}'.`);
		}

		if (this.selectedLabelId === oldLabel.id) {
			console.debug("Changing renamed selectedLabelId from", this.selectedLabelId, "to", trimmedNewName);
			this.selectedLabelId = oldLabel.id;
		}

		this.refresh();
	}

	private refreshFilteredNotes() {
		let filterFiles: string[] | undefined;

		const selectedLabelId = this.selectedLabelId;
		console.debug("selectedLabelId:", selectedLabelId);

		if (selectedLabelId === undefined || selectedLabelId === ANY_LABEL_ID) {
			filterFiles = undefined;
		} else if (selectedLabelId === NONE_LABEL_ID) {
			const noneLabel = this.labels?.find(label => label instanceof NoneLabel);

			filterFiles = noneLabel?.usingFilePaths;
		} else {
			const label = this.findNoteLabelById(selectedLabelId, this.labels ?? []);
			console.debug("label:", label);

			if (label === undefined) {
				console.log(`Label not found due to ${JSON.stringify(selectedLabelId)} not being used anymore. Clearing label filter.`);
				this.selectedLabelId = undefined;
				filterFiles = undefined;
			} else {
				filterFiles = label.usingFilePaths;
			}
		}

		this.notesTree.filterFiles(filterFiles);
	}

	private findNoteLabelById(noteLabelId: NoteLabelId, labels: Label[]): NoteLabel | undefined {
		const noteLabels = labels.filter(label => label instanceof NoteLabel);

		for (const noteLabel of noteLabels) {
			if (noteLabel.id === noteLabelId) {
				return noteLabel;
			}

			const matchingChild = this.findNoteLabelById(noteLabelId, noteLabel.children);

			if (matchingChild !== undefined) {
				return matchingChild;
			}
		}

		return undefined;
	}

	getTreeItem(label: Label): vscode.TreeItem {
		return label;
	}

	async getChildren(label?: Label): Promise<Label[]> {
		if (label) {
			return label instanceof NoteLabel ? label.children : [];
		}

		if (this.labels === undefined) {
			this.labels = await this.getAllLabels();
			console.debug("this.labels:", this.labels);

			console.debug("Refreshing filtered notes after re-getting all labels");
			this.refreshFilteredNotes();
		}

		return this.labels ?? [];
	}

	// get the notes in the notes location
	private async getAllLabels(): Promise<Label[] | undefined> {
		if (this.notesLocation === undefined || !(await LabelsViewProvider.pathAccessible(this.notesLocation))) {
			return undefined;
		} else {
			const noteFilePaths = await this.readNotesInDir(this.notesLocation);
			console.debug("noteFilePaths", noteFilePaths);

			const noteLabelEntryPromises = noteFilePaths.map(async noteFilePath => ([noteFilePath, await LabelsViewProvider.getRawLabels(noteFilePath)] as const));
			const rawLabelsPerFile = Object.fromEntries(await Promise.all(noteLabelEntryPromises));

			return [AnyLabel.INSTANCE].concat(LabelsViewProvider.toHierarchicalLabels(rawLabelsPerFile));
		}
	}

	private static async getRawLabels(filePath: string): Promise<string[]> {
		const rawLabelDetection = await LabelsViewProvider.detectRawLabels(filePath);

		return rawLabelDetection.flatMap(({ rawLabels }) => rawLabels);
	}

	private static async detectRawLabels(filePath: string): Promise<{ lineIndex: number, rawLabels: string[] }[]> {
		const fileStream = fs.createReadStream(filePath);

		// Note: we use the crlfDelay option to recognize all instances of CR LF
		// ('\r\n') in input.txt as a single line break.
		const rli = readline.createInterface({
			input: fileStream,
			crlfDelay: Infinity
		});
		let tagsHaveStarted = false;
		const result = [];
		let lineIndex = 0;

		// Go through all lines until one starts with # and continue until these lines stop skipping empty lines.
		for await (const line of rli) {
			// Each line in input.txt will be successively available here as `line`.
			const trimmedLine = line.trim();

			if (trimmedLine.length > 0) {
				if (LabelsViewProvider.IS_TAG_LINE_REGEX.test(trimmedLine)) {
					result.push({ lineIndex, rawLabels: trimmedLine.substring(1).split(LabelsViewProvider.TAG_GLUE_REGEX) });
					tagsHaveStarted = true;
				} else if (tagsHaveStarted) {
					break;
				}
			}

			lineIndex++;
		}

		return result;
	}

	private static detectLineEnding(content: string) {
		var lfIndex = content.indexOf('\n');

		return content[lfIndex - 1] === '\r' ? '\r\n' : '\n';
	}

	private static toHierarchicalLabels(rawLabelsByFile: { [key: string]: string[] }): Label[] {
		type MutableNoteLabel = { name: string, usingFilePaths: string[], children: MutableNoteLabel[] }
		const noneLabelFilePaths: string[] = [];
		const mutableLabels: MutableNoteLabel[] = [];

		for (const filePath in rawLabelsByFile) {
			const rawLabels = rawLabelsByFile[filePath];

			if (rawLabels.length === 0) {
				noneLabelFilePaths.push(filePath);
			} else {
				for (const rawLabel of rawLabels) {
					const parts = rawLabel.split(NoteLabel.TAG_GROUP_SEP);
					let parentLabel: MutableNoteLabel | undefined;

					for (let partIndex = 0; partIndex < parts.length; partIndex++) {
						const part = parts[partIndex];

						const childLabels = parentLabel?.children ?? mutableLabels;
						const existingChildLabel = childLabels.find(childLabel => childLabel.name === part);

						if (existingChildLabel === undefined) {
							const label: MutableNoteLabel = { name: part, usingFilePaths: [filePath], children: [] };
							childLabels.push(label);
							parentLabel = label;
						} else {
							existingChildLabel.usingFilePaths.push(filePath);
							parentLabel = existingChildLabel;
						}
					}
				}
			}
		}

		const immutabelizeLabels = (mutableNoteLabels: MutableNoteLabel[], ancestry: string[] = []): NoteLabel[] => {
			return mutableNoteLabels
				.sort((a,b) => a.name.localeCompare(b.name))
				.map(label => {
					const immutableChildren = immutabelizeLabels(label.children, ancestry.concat(label.name));

					return new NoteLabel(label.name, ancestry, label.usingFilePaths, immutableChildren);
				});
		}

		return (noneLabelFilePaths.length > 0 ? [new NoneLabel(noneLabelFilePaths)] : [] as Label[]).concat(immutabelizeLabels(mutableLabels));
	}


	isNoteFile(filePath: string): boolean {
		return this.notesExtensions === '*' || this.notesExtensions?.includes(path.extname(filePath)) === true;
	}

	/**
	 * @returns All paths to the notes in the dir and sub directories.
	 */
	private async readNotesInDir(dir: string): Promise<string[]> {
			try {
				const entries = await fs.promises.readdir(dir, { withFileTypes: true });
				const noteOrDirEntries = entries.filter(entry => {
					return entry.name != ".DS_Store" && entry.name != ".git" &&
						(this.notesExtensions === '*' || entry.isDirectory() || this.notesExtensions!!.includes(path.extname(entry.name)))
						&& (!entry.isDirectory() && !isBinaryFileSync(path.join(dir, entry.name)))
				})

				return (await Promise.all(noteOrDirEntries.map(async noteOrDirEntry => {
					const entryPath = path.join(dir, noteOrDirEntry.name);

					return noteOrDirEntry.isDirectory() ? await this.readNotesInDir(entryPath) : [entryPath];
				}))).flat();
			} catch (err) {
			  console.error('Error reading directory:', err);
			  return [];
			}
	}

	private static async pathAccessible(p: string): Promise<boolean> {
		try {
			await fs.promises.access(p);

			return true;
		} catch (err) {
			return false;
		}
	}
}
