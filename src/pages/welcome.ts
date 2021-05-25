"use strict";
import * as vscode from 'vscode';
import * as path from 'path';
import * as filesystem from '../filesystem';
import * as application from "../application";
import opn = require('open');

const commandMapping: Map<string, string> = new Map([
	["openGitHubIssue", "https://github.com/CycoPH/atasm-altirra-bridge/issues"],
	["openGitHubAtasm", "https://github.com/CycoPH/atasm"],
	["openDownloadAltirra", "http://www.virtualdub.org/altirra.html"],
	["openRetroCodingBlog", "https://retro.cerebus.co.za/"],
	["openDLITutorial", "https://playermissile.com/dli_tutorial/index.html"],
	["openFineScrollingTutorial", "http://playermissile.com/scrolling_tutorial/index.html"],
	["openEasy6502", "https://skilldrick.github.io/easy6502/"],
	["openMappingTheAtari", "http://www.atarimania.com/documents/Mapping-the-Atari.pdf"],
	["openDeReAtari", "http://www.atarimania.com/documents/De-Re-Atari.pdf"]
]);

export class WelcomePage implements vscode.Disposable {
	protected currentPanel: vscode.WebviewPanel | undefined = undefined;

	public dispose(): void {
	}

	public async openPage(context: vscode.ExtensionContext) {

		// Prepare
		let contentPath = path.join(context.extensionPath, 'out', 'content', 'pages', 'welcome');
		let columnToShowIn = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// Open or create panel?
		if (this.currentPanel) {
			// Open
			this.currentPanel.reveal(columnToShowIn);

		} else {
			// Create
			this.currentPanel = vscode.window.createWebviewPanel(
				'webpage',
				`${application.DisplayName}`,
				columnToShowIn || vscode.ViewColumn.One,
				{
					enableScripts: true,
					localResourceRoots: [vscode.Uri.file(contentPath)]
				}
			);

			// Content
			let startPagePath = vscode.Uri.file(path.join(contentPath.toString(), 'index.html'));
			let content = await filesystem.ReadFileAsync(startPagePath.fsPath);
			let nonce = this.getNonce();

			// Script
			let scriptJsPath = vscode.Uri.file(path.join(contentPath.toString(), 'script.js'));
			let scriptJsUri = scriptJsPath.with({ scheme: 'vscode-resource' });

			// Style
			let styleCssPath = vscode.Uri.file(path.join(contentPath.toString(), 'style.css'));
			let styleCssUri = styleCssPath.with({ scheme: 'vscode-resource' });

			// Update tags in content
			content = this.replaceContentTag(content, "APPDISPLAYNAME", application.DisplayName);
			content = this.replaceContentTag(content, "APPDESCRIPTION", application.Description);
			content = this.replaceContentTag(content, "APPVERSION", application.Version);
			content = this.replaceContentTag(content, "NONCE", nonce);
			content = this.replaceContentTag(content, "SCRIPTJSURI", scriptJsUri);
			content = this.replaceContentTag(content, "STYLECSSURI", styleCssUri);

			// Set
			this.currentPanel.webview.html = content;
		}

		// Capture command messages
		this.currentPanel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'openNewFile':
						this.openNewFileDocument("asm");
						return;

					case 'openFolder':
						const options: vscode.OpenDialogOptions = {
							canSelectFolders: true,
							canSelectMany: false,
							openLabel: 'Open Folder'
						};
						vscode.window.showOpenDialog(options).then(async folderUri => {
							if (folderUri && folderUri[0]) {
								await vscode.commands.executeCommand('vscode.openFolder', folderUri[0], false);
							}
						});
						return;

					case 'setupAltirraPath':
						this.setupAltirraPath();
						return;

					default:
						{
							let url = commandMapping.get(message.command);
							if (url) {
								this.openUrl(url);
								return;
							}
						}
				}

				// Unknown
				console.log(`debugger:WelcomePage: Unknown command called: ${message.command}`);
			}
		);

		// Capture dispose
		this.currentPanel.onDidDispose(
			() => {
				this.currentPanel = undefined;
			},
			null
		);
	}

	private getNonce() {
		let text = '';
		const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < 32; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
	}

	private replaceContentTag(content: string, tag: string, tagContent: any): string {
		tag = `%${tag}%`;
		return content.replace(new RegExp(tag, 'g'), tagContent);
	}

	private openNewFileDocument(language: string, content: string = '') {
		vscode.workspace.openTextDocument({ language: `${language}`, content: content }).then(doc => {
			// Open
			vscode.window.showTextDocument(doc);
		});
	}

	private setupAltirraPath() {
		vscode.commands.executeCommand('workbench.action.openSettings', application.Name + ".emulator.altirra.path");
		let message = `WARNING: Please set the path to your Altirra installation!`;
		application.ShowWarningPopup(message);
	}

	public async openUrl(uri: string) {
		try {
			//let options:
			opn(uri);
		}
		catch { }
	}
}