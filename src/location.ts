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
