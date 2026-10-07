import * as vscode from 'vscode';
import { Note } from './note';
import { NotesViewProvider } from './notesViewProvider';

// keeps the Notes view in sync with notes added, renamed or removed outside of this window,
// by a sync client or another editor for example
export class NotesWatcher implements vscode.Disposable {

	private watching: vscode.Disposable[] = [];
	private pollTimer: ReturnType<typeof setInterval> | undefined;
	private refreshTimer: ReturnType<typeof setTimeout> | undefined;
	private checking = false;
	private listeners: vscode.Disposable[];

	constructor(
		private tree: NotesViewProvider,
		private view: vscode.TreeView<Note>) {
		this.listeners = [
			view.onDidCollapseElement(e => tree.forgetFolder(e.element.fullPath)),
			// catch up on whatever happened while the view was hidden
			view.onDidChangeVisibility(e => {
				if (e.visible) {
					this.check();
				}
			})
		];
	}

	// watch a storage location, or nothing if it is empty or watching is turned off
	restart(notesLocation: string): void {
		this.stop();

		const config = vscode.workspace.getConfiguration('notes');
		if (!notesLocation || !config.get<boolean>('watchExternalChanges', true)) {
			return;
		}

		// file system events are immediate, edits are ignored since the tree only shows names
		try {
			const fileWatcher = vscode.workspace.createFileSystemWatcher(
				new vscode.RelativePattern(vscode.Uri.file(notesLocation), '**/*'), false, true, false);
			this.watching.push(
				fileWatcher,
				fileWatcher.onDidCreate(() => this.scheduleRefresh()),
				fileWatcher.onDidDelete(() => this.scheduleRefresh())
			);
		} catch (err) {
			console.error('Failed to watch the notes location:', err);
		}

		// a synced folder, or a Windows folder seen from WSL, may never send an event,
		// so the folders on screen are also checked on an interval while the view is visible
		const seconds = Math.min(Math.max(config.get<number>('watchIntervalSeconds', 5), 2), 60);
		this.pollTimer = setInterval(() => this.check(), seconds * 1000);
	}

	// several events usually arrive together, refresh once
	private scheduleRefresh(): void {
		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer);
		}
		this.refreshTimer = setTimeout(() => {
			this.refreshTimer = undefined;
			this.tree.refresh();
		}, 200);
	}

	// refresh if a folder on screen changed on disk
	private async check(): Promise<void> {
		// a slow folder can take longer than the interval, skip until the last check is done
		if (!this.view.visible || this.checking) {
			return;
		}
		this.checking = true;
		try {
			if (await this.tree.hasExternalChanges()) {
				this.tree.refresh();
			}
		} catch (err) {
			console.error('Failed to check the notes location for changes:', err);
		} finally {
			this.checking = false;
		}
	}

	private stop(): void {
		this.watching.forEach(d => d.dispose());
		this.watching = [];
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
			this.pollTimer = undefined;
		}
		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer);
			this.refreshTimer = undefined;
		}
	}

	dispose(): void {
		this.stop();
		this.listeners.forEach(d => d.dispose());
	}
}
