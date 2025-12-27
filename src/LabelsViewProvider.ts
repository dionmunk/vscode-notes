import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { isBinaryFileSync } from 'isbinaryfile';
import LabelId, { ANY_LABEL_ID, NONE_LABEL_ID } from './LabelId';
import Label, { AnyLabel, NoneLabel, NoteLabel } from './Label';

// TODO: Detect updates on notes updating the labels.
// TODO: Edit labels updating all referencing files at once.
// TODO: Optimization: Cache the labels index in a metadata file.
// TODO: Add auto-complete to label input
export class LabelsViewProvider implements vscode.TreeDataProvider<Label> {

	private _onDidChangeTreeData: vscode.EventEmitter<Label | undefined> = new vscode.EventEmitter<Label | undefined>();

	readonly onDidChangeTreeData: vscode.Event<Label | undefined> = this._onDidChangeTreeData.event;

	private labels: Label[] | undefined;

	private static IS_TAG_LINE_REGEX = /^#[^#\s]+(\s+#[^#\s]+)*$/;

	private static TAG_GLUE_REGEX = /\s+#/;

	private static TAG_GROUP_SEP = "/";

	constructor(
		private notesLocation: string | undefined,
		private notesExtensions: string | undefined) {
	};

	public init(): LabelsViewProvider {
		this.refresh();

		return this;
	}

	/**
	 * @return List of file paths.
	 */
	getFilteredNotes(labelId: LabelId): string[] | undefined {
		if (labelId === ANY_LABEL_ID) {
			return undefined;
		} else if (labelId === NONE_LABEL_ID) {
			const noneLabel = this.labels?.find(label => label instanceof NoneLabel);

			return noneLabel?.usingFilePaths;
		} else {
			const label = this.labels
				?.filter(label => label instanceof NoteLabel)
				?.find(({ name: someName, ancestors: someAncestors }) => {
					return someName === labelId.name && someAncestors === labelId.ancestors;
				});

			return label?.usingFilePaths ?? [];
		}
	}

	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
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
			console.log("this.labels", this.labels);
		}

		return this.labels ?? [];
	}

	// get the notes in the notes location
	private async getAllLabels(): Promise<Label[] | undefined> {
		if (this.notesLocation === undefined || !(await LabelsViewProvider.pathAccessible(this.notesLocation))) {
			return undefined;
		} else {
			const noteFilePaths = await this.readNotesInDir(this.notesLocation);
			console.log("noteFilePaths", noteFilePaths);

			const noteLabelEntryPromises = noteFilePaths.map(async noteFilePath => ([noteFilePath, await LabelsViewProvider.getRawLabels(noteFilePath)] as const));
			const rawLabelsPerFile = Object.fromEntries(await Promise.all(noteLabelEntryPromises));

			return [AnyLabel.INSTANCE].concat(LabelsViewProvider.toHierarchicalLabels(rawLabelsPerFile));
		}
	}

	private static async getRawLabels(filePath: string): Promise<string[]> {
		const fileStream = fs.createReadStream(filePath);

		// Note: we use the crlfDelay option to recognize all instances of CR LF
		// ('\r\n') in input.txt as a single line break.
		const rli = readline.createInterface({
			input: fileStream,
			crlfDelay: Infinity
		});
		let tagsHasStarted = false;
		const rawLabels: string[] = [];

		// Go through all lines until one starts with # and continue until these lines stop skipping empty lines.
		for await (const line of rli) {
			// Each line in input.txt will be successively available here as `line`.
			// console.log(`Line from file: ${line}`);
			const trimmedLine = line.trim();

			if (trimmedLine.length > 0) {
				if (LabelsViewProvider.IS_TAG_LINE_REGEX.test(trimmedLine)) {
					rawLabels.push(...trimmedLine.substring(1).split(LabelsViewProvider.TAG_GLUE_REGEX));
					tagsHasStarted = true;
				} else if (tagsHasStarted) {
					break;
				}
			}
		}

		return rawLabels;
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
					const parts = rawLabel.split(LabelsViewProvider.TAG_GROUP_SEP);
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
