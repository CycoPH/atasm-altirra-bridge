// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as application from './application';
import { WelcomePage } from './pages/welcome';
import './statusbar';

import { AsmSymbolProvider } from './explorer/asmSymbols';

import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';

let taskProvider: vscode.Disposable | undefined;
let atasmConfigWatcher: vscode.FileSystemWatcher | undefined;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	// Pages
	let welcomePage = new WelcomePage();

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

	// Welcome
	const openWelcomePage = vscode.commands.registerCommand('extension.openWelcomePage', () => {
		//console.log('User activated command "extension.openWelcomePage"');
		welcomePage.openPage(context);
	});

	// Build
	// Note: apparently the fileUri can be supplied via the command line but we are not going to use it
	const buildGame = vscode.commands.registerCommand('extension.buildGame', async (fileUri: vscode.Uri) => {
		await application.BuildGameAsync(fileUri);
	});
	const buildGameAndRun = vscode.commands.registerCommand('extension.buildGameAndRun', async (fileUri: vscode.Uri) => {
		await application.BuildGameAndRunAsync(fileUri);
	});
	const buildAndDebug = vscode.commands.registerCommand('extension.buildAndDebug', async (fileUri: vscode.Uri) => {
		await application.BuildAndDebugAsync(fileUri);
	});
	// Open configuration file for build and run settings
	const createAtasmBuildJson = vscode.commands.registerCommand('extension.createAtasmBuildJson', async () => {
		await application.CreateAtasmBuildJsonAsync();
	});
	// Reset the build process
	const resetBuild = vscode.commands.registerCommand('extension.resetBuild', async () => {
		await application.ResetBuildAsync();
	});
	// Hook up the folder for config file checking
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (folder) {
		let buildConfigPromise: Thenable<vscode.Task[]> | undefined = undefined;

		vscode.window.onDidChangeActiveTextEditor(() => application.ClearBuildConfig());

		atasmConfigWatcher = vscode.workspace.createFileSystemWatcher(path.join(folder.uri.fsPath, application.AtasmBuildFilename));
		atasmConfigWatcher.onDidChange(() => application.ClearBuildConfig());
		atasmConfigWatcher.onDidCreate(() => application.ClearBuildConfig());
		atasmConfigWatcher.onDidDelete(() => application.ClearBuildConfig());

		taskProvider = vscode.tasks.registerTaskProvider('atasm', {
			provideTasks: () => {
				buildConfigPromise = getAssemblerTasks();
				return buildConfigPromise;
			},
			resolveTask(_task: vscode.Task): vscode.Task | undefined {
				return undefined;
			}
		});
	}

	// Subscriptions (register)
	context.subscriptions.push(openWelcomePage);
	context.subscriptions.push(buildGame);
	context.subscriptions.push(buildGameAndRun);
	context.subscriptions.push(buildAndDebug);
	context.subscriptions.push(resetBuild);

	// Register intellisense features
	//await application.RegisterDocumentSymbolProvidersAsync(context);
	//await application.RegisterDefinitionProvidersAsync(context);
	//await application.RegisterReferenceProvidersAsync(context);
	//await application.RegisterCompletionProvidersAsync(context);

	// Show welcome messages
	await application.ShowStartupMessagesAsync();

	// Fix Linux/MacOS exec permissions on shipped atasm
	await application.SelectAssembler().FixExecPermissions();

	// Setup the constant/label/etc symbol explorer window and callbacks
	const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0)) ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
	const asmSymbolsProvider = new AsmSymbolProvider(rootPath);
	vscode.window.registerTreeDataProvider('asmSymbolExplorer', asmSymbolsProvider);
	vscode.commands.registerCommand('asmSymbolExplorer.refreshEntry', () => asmSymbolsProvider.refresh());
	vscode.commands.registerCommand('extension.openSourceAtLine', async info => {
		// Goto the file and line number
		const uri = vscode.Uri.joinPath(vscode.Uri.file(info.loc), info.file);

		vscode.workspace.openTextDocument(uri).then(doc => {
            vscode.window.showTextDocument(doc, { preview: false }).then(editor => {
                const line: number = parseInt(info.ln, 10)-1;
				editor.selection = new vscode.Selection(new vscode.Position(line, 0), new vscode.Position(line, 0));
				editor.revealRange(new vscode.Range(line, 0, line, 0), vscode.TextEditorRevealType.Default);
            });
        });
	});
}

// this method is called when your extension is deactivated
export function deactivate() { }

interface AssemblerTaskDefinition extends vscode.TaskDefinition {
	task: string;
}

async function getAssemblerTasks(): Promise<vscode.Task[]> {
	let tasks: vscode.Task[] = [];

	let buildConfig: application.AtasmConfigurationDefinition | undefined = undefined;

	let editor = vscode.window.activeTextEditor;

	if (editor && editor.document && editor.document.fileName && (editor.document.languageId === "atasm" || editor.document.languageId === "json" )) {
		let input: string = editor.document.fileName;

		const folder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
		if (folder) {

			try {
				const readFile = util.promisify(fs.readFile);
				const readFileData = await readFile(path.join(folder || "", application.AtasmBuildFilename), "utf-8");
				buildConfig = JSON.parse(readFileData);

				// If there in a input file set then register a task to build the input file.
				if (buildConfig?.input && buildConfig?.input.trim().length > 0) {
					let commandLine = await application.getAssemblerCommandLine4Task(undefined);
					if (commandLine.length) {
						let buildTaskDef: AssemblerTaskDefinition = { type: "atasm", task: "From JSON" };
						let buildTask = new vscode.Task(buildTaskDef, vscode.TaskScope.Workspace, "Assemble from atasm-build settings", "atasm",
							new vscode.ShellExecution(commandLine),
							["$atasm"]);
						buildTask.group = vscode.TaskGroup.Build;

						tasks.push(buildTask);
					}
				}
			}
			catch (err) {
				// There was a problem loading the atasm-build.json file.
			}
		}

		if (editor.document.languageId === "atasm") {
			let commandLine = await application.getAssemblerCommandLine4Task(input);
			if (commandLine.length) {
				let buildTaskDef: AssemblerTaskDefinition = { type: "atasm", task: "Direct" };
				let buildTask = new vscode.Task(buildTaskDef, vscode.TaskScope.Workspace, "Assemble the current file only", "atasm",
					new vscode.ShellExecution(commandLine),
					["$atasm"]);
				buildTask.group = vscode.TaskGroup.Build;

				tasks.push(buildTask);
			}
		}
	}

	return tasks;

}