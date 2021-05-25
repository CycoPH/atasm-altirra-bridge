/* eslint-disable @typescript-eslint/naming-convention */
"use strict";
import * as vscode from 'vscode';
import * as filesystem from './filesystem';
const os = require("os");
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';

import { AssemblerRunner } from './assembler/AssemblerRunner';
import { EmulatorRunner } from './emulators/EmulatorRunner';


// -------------------------------------------------------------------------------------
// Operating System
// -------------------------------------------------------------------------------------
export const OSPlatform: any = os.platform();
export const OSArch: any = os.arch();
export const IsWindows: boolean = (os.platform() === 'win32');
export const IsLinux: boolean = (os.platform() === 'linux');
export const IsMacOS: boolean = (os.platform() === 'darwin');
export const Is32Bit: boolean = (os.arch() === 'x32');
export const Is64Bit: boolean = (os.arch() === 'x64');

// -------------------------------------------------------------------------------------
// Extension
// -------------------------------------------------------------------------------------
export const Id = "cerebus.atasm-altirra-bridge";
export const Path: string = vscode.extensions.getExtension(Id)!.extensionPath;
export const Name: string = vscode.extensions.getExtension(Id)!.packageJSON.name;
export const Publisher: string = vscode.extensions.getExtension(Id)!.packageJSON.publisher;
export const Version: string = vscode.extensions.getExtension(Id)!.packageJSON.version;
export const DisplayName: string = vscode.extensions.getExtension(Id)!.packageJSON.displayName;
export const ShortName: string = vscode.extensions.getExtension(Id)!.packageJSON.shortName;
export const Description: string = vscode.extensions.getExtension(Id)!.packageJSON.description;
export const PreferencesSettingsExtensionPath: string = `${(IsMacOS ? "Code" : "File")} -> Preferences -> Settings -> Extensions -> ${DisplayName}`;
export const ChangeLogUri: vscode.Uri = vscode.Uri.parse(`https://marketplace.visualstudio.com/items/${Id}/changelog`);

export const AtasmBuildFilename: string = "atasm-build.json";

// -------------------------------------------------------------------------------------
// Channels
// -------------------------------------------------------------------------------------
export const CompilerOutputChannel: vscode.OutputChannel = vscode.window.createOutputChannel("Compiler");

// -------------------------------------------------------------------------------------
// Objects
// -------------------------------------------------------------------------------------
export const Assembler: AssemblerRunner = new AssemblerRunner();
export const Emulator: EmulatorRunner = new EmulatorRunner();
export var WorkspaceFolder: string = "";

// -------------------------------------------------------------------------------------
// Configuration
// -------------------------------------------------------------------------------------
export interface AtasmConfigurationDefinition {
	input: string | undefined;				// Which asm file is the root of the project
	includes: string[] | undefined;			// List of include folders: -Idir1 -Idir2
	outputFolder: string | undefined;		// Where is the output going?
	params: string | undefined;				// What parameters are being sent to atasm
	symbols: string[] | undefined;			// List of symbols to be set via -D parameters
	withDebug: boolean;						// Generate debug info?
}

let buildConfig: AtasmConfigurationDefinition | undefined = undefined;

export function ClearBuildConfig() {
	buildConfig = undefined;
}

export function GetBuildConfig(): AtasmConfigurationDefinition | undefined {
	return buildConfig;
}

export async function EnsureBuildConfigIsLoaded(): Promise<boolean> {
	if (buildConfig) {
		return true;
	}
	return await LoadBuildConfigAsync();
}

/**
 * Load the build configuration json file
 * @param retrying True if we are redoing the load
 * @returns true if its all loaded, false if the file is not there or needs configuration
 */
export async function LoadBuildConfigAsync(retrying: boolean = false): Promise<boolean> {
	if (!vscode.workspace.workspaceFolders) {
		if (!retrying) {
			vscode.window.showInformationMessage('No folder or workspace opened');
		}
		return false;
	}
	const folder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
	if (folder) {

		WorkspaceFolder = folder;

		try {
			const readFile = util.promisify(fs.readFile);
			const readFileData = await readFile(path.join(folder || "", AtasmBuildFilename), "utf-8");
			buildConfig = JSON.parse(readFileData);
			return true;
		}
		catch (err) {
			// There was a problem loading the atasm-build.json file.
			buildConfig = undefined;
			if (await CreateAtasmBuildJsonAsync()) {
				return false;
			}
			if (!retrying) {
				return await LoadBuildConfigAsync(true);
			}
			return false;
		}
	}
	else {
		buildConfig = undefined;
		return false;
	}
}

// -------------------------------------------------------------------------------------
// Functions
// -------------------------------------------------------------------------------------
export async function BuildGameAsync(fileUri: vscode.Uri): Promise<boolean> {

	if (!await SaveFilesAndContinueAsync(fileUri)) {
		vscode.window.showErrorMessage("Unable to save files");
		return false;
	}
	if (!await EnsureBuildConfigIsLoaded()) {
		vscode.window.showErrorMessage("Build configuration not setup");
	}

	return await Assembler.BuildGameAsync();
}

export async function BuildGameAndRunAsync(fileUri: vscode.Uri): Promise<boolean> {
	if (!await BuildGameAsync(fileUri)) {
		return false;
	}
	// Build went ok, now launch in Altirra
	await Emulator.RunGameAsync(Assembler.OutputFileName);

	// Result
	return true;
}

export async function BuildAndDebugAsync(fileUri: vscode.Uri): Promise<boolean> {
	let breakpoints = vscode.debug.breakpoints;
	if (!await BuildGameAsync(fileUri)) {
		return false;
	}
	// Build went ok, now launch in Altirra with debug turned on

	await SaveBreakpoints();

	// Build went ok, now launch in Altirra
	await Emulator.RunDebuggerAsync(Assembler.OutputFileName);

	// Result
	return true;
}

/**
 * Save the breakpoints to the output folder (as used by the assembler)
 * @returns true if the breakpoints were saved away
 */
export async function SaveBreakpoints(): Promise<boolean> {
	var folder = Assembler.OutputBreakpoints;
	if (!folder || folder.length === 0) {
		return false;
	}
	var breakLines = "";
	var lastSrcFile = "";
	var fixedSrcFile = "";			// corrected \ to /

	var atdbgLines = "";

	var atLines: number[] = [];
	var numFiles = 0;
	var numBreakpoints = 0;

	WriteToCompilerTerminal("Processing breakpoints...");

	let breakpoints = vscode.debug.breakpoints;
	breakpoints.forEach(element => {
		if (element !== undefined || element !== null) {
			let point = <vscode.SourceBreakpoint>element;
			if (point.enabled && point.location.uri.scheme === "file") {
				var file = path.relative(WorkspaceFolder, point.location.uri.fsPath);
				if (lastSrcFile !== file.toLowerCase()) {
					++numFiles;
					// New source file, if there is data from another one sort the line numbers and write away
					if (atLines.length > 0) {
						var sorted: number[] = atLines.sort((n1, n2) => n1 - n2);
						sorted.forEach(x => breakLines += `${x}` + os.EOL);
					}
					lastSrcFile = file.toLowerCase();
					fixedSrcFile = lastSrcFile.replace(/\\/gi, '/');
					breakLines += `Source: ${fixedSrcFile}` + os.EOL;
					atLines = [];
				}
				++numBreakpoints;
				atLines.push(point.location.range.start.line + 1);
				if (point.condition) {
					atdbgLines += `bx "${point.condition}"` + os.EOL;
				}
				else {
					atdbgLines += `bp -k -q \`${fixedSrcFile}:${point.location.range.start.line + 1}\`` + os.EOL;
				}
			}
		}
	});
	if (atLines.length > 0) {
		var sorted: number[] = atLines.sort((n1, n2) => n1 - n2);
		sorted.forEach(x => breakLines += `${x}` + os.EOL);
	}

	if (breakLines.length > 0) {
		// Write the new breakpoint locations to file
		let writeData = Buffer.from(breakLines, 'utf8');
		await vscode.workspace.fs.writeFile(vscode.Uri.file(Assembler.OutputBreakpoints), writeData);

		// Write the .atdbg debugger script to disc
		// 1. Prepend some commands
		atdbgLines = "bc *" + os.EOL + atdbgLines + `.echo ${numBreakpoints} breakpoints from ${numFiles} files have been set}` + os.EOL;
		atdbgLines += ".sourcemode on" + os.EOL;

		writeData = Buffer.from(atdbgLines, 'utf8');
		await vscode.workspace.fs.writeFile(vscode.Uri.file(Assembler.OutputDebugCmds), writeData);

		WriteToCompilerTerminal(`${numBreakpoints} breakpoints from ${numFiles} files have been recorded.`);

	}

	return true;
}

/**
 * Create or open the 'atasm-build.json' configuration file.
 * Returns true if the file was newly created
 */
export async function CreateAtasmBuildJsonAsync(): Promise<boolean> {
	if (!vscode.workspace.workspaceFolders) {
		vscode.window.showInformationMessage('No folder or workspace opened');
		return false;
	}
	// First check if the 'atasm-build.json' file is already there
	// if it is on disk then just open it for editing
	const folderUri = vscode.workspace.workspaceFolders?.[0].uri;
	if (folderUri) {
		let filename = path.join(folderUri.fsPath, AtasmBuildFilename);

		let uri = vscode.Uri.file(filename);

		try {
			// Open the existing file
			await vscode.workspace.fs.stat(uri);
			vscode.window.showTextDocument(uri, { viewColumn: vscode.ViewColumn.Active });
		} catch {
			let configSrc = [
				"comment", "Altrirra configuration file.",
				"\n",
				"_1", "Which asm file is to be compiled?",
				"input", "theapp.asm",
				"\n",
				"_2", "Array of folders that will be searched when files are .include(d)",
				"includes", "[]",
				"\n",
				"_3", "Which folder will all the output files be written to. 'out' by default",
				"outputFolder", "out",
				"\n",
				"_4", "Additional atasm parameters:-v -s -u -r -fvalue",
				"params", "",
				"\n",
				"_5", "List of symbols to be set via the parameter list",
				"symbols", "[]",
				"\n",
				"_6", "If debug is enabled then symbol table and listings are generated for Altirra debugging",
				"withDebug", true
			];
			let config = "{" + os.EOL;
			for (var i = 0; i < configSrc.length;) {
				if (configSrc[i] === "\n") {
					config += os.EOL;
					++i;
				} else {
					config += `\t"${configSrc[i]}": `;
					++i;
					if (configSrc[i] === null) {
						config += "null";
					} else if (configSrc[i] === "[]") {
						config += "[]";
					} else if (typeof configSrc[i] === 'boolean') {
						config += configSrc[i];
					} else {
						config += `"${configSrc[i]}"`;
					}
					++i;
					if (i < configSrc.length) {
						config += "," + os.EOL;
					}
				}
			}
			config += os.EOL + "}" + os.EOL;

			const writeData = Buffer.from(config, 'utf8');

			const fileUri = folderUri.with({ path: path.join(folderUri.fsPath, AtasmBuildFilename) });

			await vscode.workspace.fs.writeFile(fileUri, writeData);

			vscode.window.showTextDocument(uri, { viewColumn: vscode.ViewColumn.Active });
		}

		return true;
	}
	return false;
}

export function WriteToCompilerTerminal(message: string, writeToLog: boolean = false): void {
	CompilerOutputChannel.appendLine(message);
	if (writeToLog) { console.log(`debugger:${message}`); }
}

export function ShowWarningPopup(message: string): void {
	vscode.window.showWarningMessage(message);
}

export function ShowInformationPopup(message: string): void {
	vscode.window.showInformationMessage(message);
}

export function ShowErrorPopup(message: string): void {
	vscode.window.showErrorMessage(message);
}

export function GetConfiguration(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration(Name, null);
}

export async function ShowStartupMessagesAsync(): Promise<void> {
	// Prepare
	let configuration = GetConfiguration();

	// Load settings
	let showNewVersionMessage = configuration.get<string>(`application.configuration.showNewVersionMessage`);
	let latestVersion = configuration.get<string>(`application.configuration.latestVersion`);

	// Process?
	if (!showNewVersionMessage || latestVersion === Version) { return; }

	// Update latest version
	configuration.update(`application.configuration.latestVersion`, Version, vscode.ConfigurationTarget.Global);

	// buttons
	let latestChanges = "Learn more about the latest changes";
	let dontShowMeThisMessage = "Don't show me this message again";

	// Show prompt
	await vscode.window.showInformationMessage(`Welcome to the new version of ${DisplayName}`,
		latestChanges, dontShowMeThisMessage)
		.then(selection => {
			if (selection === undefined) {
				// Dismissed
			}
			else if (selection === latestChanges) {
				// Show changelog
				vscode.env.openExternal(ChangeLogUri);
			}
			else if (selection = dontShowMeThisMessage) {
				// Disable
				configuration.update(`application.configuration.showNewVersionMessage`, false, vscode.ConfigurationTarget.Global);
			}
		});
}

export function delay(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// --------------------------------------------------------
// Private

export async function SaveFilesAndContinueAsync(fileUri: vscode.Uri | undefined): Promise<boolean> {
	let configuration = GetConfiguration();

	let result: boolean = true;

	if (configuration.get<boolean>(`editor.saveAllFilesBeforeBuild`)) {
		result = await vscode.workspace.saveAll();
	} else if (configuration.get<boolean>(`editor.saveFileBeforeBuild`)) {
		if (fileUri) {
			let document = await filesystem.GetDocumentAsync(fileUri);
			if (document && document.uri.scheme === "file") {
				result = await document.save();
			}
		}
	}
	return result;
}

export async function getAssemblerCommandLine(filename: string | undefined): Promise<string> {
	return await Assembler.GetAssemblerCommandLine(filename);
}