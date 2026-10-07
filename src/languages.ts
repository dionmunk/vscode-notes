import * as vscode from 'vscode';
import * as path from 'path';

let languages: Map<string, string> | undefined;

// the file extensions VS Code has a language for, with the language, from every installed extension
// including the built-in ones; read once and again when extensions change
export function getLanguageExtensions(): Map<string, string> {
	if (!languages) {
		// plain text is registered by VS Code itself rather than by an extension
		languages = new Map<string, string>([['txt', 'plaintext']]);
		for (const extension of vscode.extensions.all) {
			for (const language of extension.packageJSON?.contributes?.languages ?? []) {
				for (const fileExtension of language.extensions ?? []) {
					const key = String(fileExtension).replace(/^\./, '').toLowerCase();
					if (!languages.has(key)) {
						languages.set(key, language.id);
					}
				}
			}
		}
	}
	return languages;
}

// forget the languages read so far, so newly installed extensions count
export function resetLanguageExtensions(): void {
	languages = undefined;
}

// is a file a Markdown note?
export function isMarkdownFile(fileName: string): boolean {
	const extension = path.extname(fileName).slice(1).toLowerCase();
	return getLanguageExtensions().get(extension) === 'markdown' || ['md', 'markdown'].includes(extension);
}
