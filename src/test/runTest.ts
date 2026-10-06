import * as path from 'path';

import { runTests } from '@vscode/test-electron';

async function main() {
	try {
		// set when this runs from a terminal inside VS Code: ELECTRON_RUN_AS_NODE would make the downloaded
		// VS Code run as plain Node, and the VSCODE_ variables belong to the VS Code that owns the terminal
		for (const name of Object.keys(process.env)) {
			if (name === 'ELECTRON_RUN_AS_NODE' || name.startsWith('VSCODE_')) {
				delete process.env[name];
			}
		}

		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');

		// The path to test runner
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './suite/index');

		// Download VS Code, unzip it and run the integration test
		await runTests({ extensionDevelopmentPath, extensionTestsPath });
	} catch (err) {
		console.error('Failed to run tests', err);
		process.exit(1);
	}
}

main();
