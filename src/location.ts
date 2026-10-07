import * as fs from 'fs';
import * as path from 'path';

// state of the notes storage location, also used as the 'notes.locationState' context key
//   unset   - no storage location has been chosen
//   missing - a location is set but it is not an existing folder
//   empty   - the location is a folder with no notes in it (set by the tree)
//   ready   - the location is a folder with notes in it
export type LocationState = 'unset' | 'missing' | 'empty' | 'ready';

// turn the notesLocation setting into an absolute path
// a leading ~ is the home folder and a relative path is relative to the workspace folder
// returns '' if no location is set, and the path unchanged if it is relative and there is no workspace folder
export function resolveNotesLocation(location: string | undefined, homeDir: string, workspaceDir?: string): string {
	let resolved = (location ?? '').trim();

	if (!resolved) {
		return '';
	}

	// expand ~ to the home folder
	if (resolved === '~' || resolved.startsWith('~/') || resolved.startsWith('~' + path.sep)) {
		resolved = path.join(homeDir, resolved.slice(1));
	}

	if (path.isAbsolute(resolved)) {
		return path.resolve(resolved);
	}

	return workspaceDir ? path.resolve(workspaceDir, resolved) : resolved;
}

// check whether a resolved location can be used to store notes
export function getLocationState(location: string): LocationState {
	if (!location) {
		return 'unset';
	}

	// a relative path that could not be resolved is never used, it would depend on the process folder
	if (!path.isAbsolute(location)) {
		return 'missing';
	}

	try {
		return fs.statSync(location).isDirectory() ? 'ready' : 'missing';
	} catch (err) {
		return 'missing';
	}
}

// the value saved for a folder picked as the workspace notes location: relative to the workspace folder
// when it is inside it, so the setting works for anyone who clones the project, otherwise the full path
export function toWorkspaceSetting(folder: string, workspaceDir: string): string {
	const relative = path.relative(workspaceDir, folder);
	if (relative === '') {
		return '.';
	}
	if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
		return path.normalize(folder);
	}
	// forward slashes work on every platform, and the setting may be shared through the repository
	return relative.split(path.sep).join('/');
}

// the folder holding a portable VS Code, which a relative notes location is resolved against so the notes
// travel with it: VS Code sets VSCODE_PORTABLE to its portable data folder, the `data` folder in the
// program folder on Windows and Linux, or `code-portable-data` next to the application on macOS
export function getPortableFolder(env: NodeJS.ProcessEnv = process.env): string | undefined {
	const portableData = env.VSCODE_PORTABLE;
	return portableData ? path.dirname(portableData) : undefined;
}

// is a path the folder itself or somewhere inside it?
export function isInside(target: string, folder: string): boolean {
	const relative = path.relative(folder, target);
	return relative === '' || !(relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative));
}

// where a note or folder ends up when moved into a folder, or undefined when the move would do nothing
// (it is already there) or is impossible (a folder moved into itself)
export function getMoveDestination(source: string, targetFolder: string): string | undefined {
	if (isInside(targetFolder, source) || path.resolve(path.dirname(source)) === path.resolve(targetFolder)) {
		return undefined;
	}
	return path.join(targetFolder, path.basename(source));
}

// split a typed note name into its name and the extension it ends with, when that extension is one a note can have:
// in the list of allowed extensions, or with '*' one VS Code has a language for, so `query.sql` keeps `.sql`
// while the `.07` of `Meeting 2026.10.07` stays part of the name
export function splitNoteName(name: string, allowedExtensions: string, languageExtensions: ReadonlySet<string>): { base: string, extension?: string } {
	const dotted = path.extname(name);
	const extension = dotted.slice(1);
	if (!extension) {
		return { base: name };
	}
	const allowed = allowedExtensions.split(',').map(allowedExtension => allowedExtension.trim().toLowerCase());
	const usable = allowed.includes('*') ? languageExtensions.has(extension.toLowerCase()) : allowed.includes(extension.toLowerCase());
	return usable ? { base: name.slice(0, -dotted.length), extension } : { base: name };
}

// does a typed name refer to a note, by its file name or by its name without the extension?
export function isNoteName(typed: string, fileName: string): boolean {
	const name = typed.trim().toLowerCase();
	return name === fileName.toLowerCase() || name === path.parse(fileName).name.toLowerCase();
}
