/* eslint-disable @typescript-eslint/naming-convention */
"use strict";
import * as vscode from 'vscode';
import * as application from './application';

class StatusBar {

	constructor() {
		this.Initialise();
	}

	private Initialise(): void {
		// Prepare
		let configuration = application.GetConfiguration();

		// Prepare
		let command = (configuration.get<string>('editor.statusBarCommands', 'Full'));
		if (command === "None") { return; }

		// Spacer
		let itemOptions = [
			{ text: `   ` },
		];
		itemOptions.forEach(option => this.createItem(option));

		// Name and version
		if (command === "Full") {
			let itemOptions = [
				{ text: `${application.ShortName}` },
			];
			itemOptions.forEach(option => this.createItem(option));
		}

		// Buttons
		if (command === "Full" || command === "Minimum") {
			let itemOptions = [
				{ tooltip: 'Welcome', text: '$(home)', command: 'extension.openWelcomePage' },
				{ tooltip: 'Assemble source code (Shift+F5)', text: '$(play)', command: 'extension.buildGame' },
				{ tooltip: 'Assemble source code and run in emulator (F5)', text: '$(rocket)', command: 'extension.buildGameAndRun' },
				{ tooltip: 'Assemble source code and debug in emulator (Ctrl+F5)', text: '$(debug-alt)', command: 'extension.buildAndDebug' },
				{ tooltip: 'Configure', text: '$(gear)', command: 'extension.createAtasmBuildJson' }
			];
			itemOptions.forEach(option => this.createItem(option));
		}
	}

	private createItem(option: any, alignment?: vscode.StatusBarAlignment | undefined, priority?: number | undefined): void {
		// Create
		let item = vscode.window.createStatusBarItem(alignment, priority);
		item.command = option.command;
		item.text = option.text;
		item.tooltip = option.tooltip;

		// Display
		item.show();
	}
}


const statusbar = new StatusBar();
export default statusbar;