/* eslint-disable @typescript-eslint/naming-convention */
"use strict";
import * as vscode from 'vscode';
import * as path from 'path';
import * as application from '../application';
import * as filesystem from '../filesystem';
import * as execute from '../execute';

export abstract class AssemblerRunnerBase implements vscode.Disposable {
	// Features
	public Id: string;

	// These are items the emulator is interested in
	public InputFileName: string = "";					// The file being compiled (the input)
	public InputFileNameBase: string = "";				// Just the name part of the input, without the extension
	public OutputFolder: string = "";					// Where will all the output go
	public OutputFileName: string = "";					// The path and name of the assembled file
	public OutputSymbolsFileName: string = "";
	public OutputListFileName: string = "";
	public OutputBreakpoints: string = "";				// The file that set breakpoints will be written to
	public OutputDebugCmds: string = "";				// Altirra debug commands to set breakpoints
	
	public IsRunning: boolean = false;
	protected Configuration: vscode.WorkspaceConfiguration | undefined;
	public BuildConfig: application.AtasmConfigurationDefinition | undefined = undefined;
	public WorkspaceFolder: string = "";

	constructor(id: string) {
		this.Id = id;
		this.InitOriginalPath();
	}

	public dispose(): void {
	}

	// Public interface
	// - BuildGameAsync


	public async BuildGameAsync(): Promise<boolean> {

		// Initialise
		let result = await this.InitialiseAsync();
		if (!result) { return false; }

		// Execute
		return await this.ExecuteAssemblerAsync();
	}

	public ResetBuild(): void {
		this.IsRunning = false;
	}

	
	// ==================================================================================
	// Functions to create the assembler command line when doing stuff via a task
	// ==================================================================================

	/**
	 * Build the command to execute in a VSCode Task<>
	 * @param thisAsmFile Assembler file to compile
	 * @returns string to execute in the VSCode task
	 */
	 public async GetAssemblerCommandLine4Task(thisAsmFile: string | undefined): Promise<string> {
		this.InitGetAssemblerCommandLineGetter();

		let args: string[] = thisAsmFile ? await this.GetAssemblerCommandLineDirectly(thisAsmFile) : await this.GetAssemblerCommandLineFromBuildInfo();

		if (application.IsWindows) {
			// ShellExecution will run the command in a PowerShell -command
			// The whole thing needs to be "& {....}" escaped and each parameter (not the first one needs to be in '...')
			var cmd = `"& {${args[0]}`;
			for (var i = 1; i < args.length; ++i) {
				cmd += ` '${args[i]}'`;
			}
			cmd += '}"';
			return cmd;
		}

		return "";
	}



	// Protected interface
	protected GetWorkspaceFolder(): string {
		// Workspace (last resort)
		if (vscode.workspace.workspaceFolders) {
			return vscode.workspace.workspaceFolders[0].uri.fsPath;
		}
		return "";
	}

	public Extensions:string[] = [
		".asm",
		".a",
		".s",
		".m65"
	];
	protected async GetDefaultOrFirstAsmFilename(hardDefault: string): Promise<string> {
		if (!this.Configuration) {
			// There is no configuration, so not much to check
			return "theapp.asm";
		}

		// 1. Get the configured default filename
		let defaultBuildFilename = this.Configuration.get<string>("application.configuration.defaultAsmFileToAssemble", "").trim();

		if (defaultBuildFilename && defaultBuildFilename.length > 0) {
			// Got a default filename.
			return defaultBuildFilename;
		}

		// Got no default file.
		// 2. Check if the current open file is an assembler file
		let doCurrentEditorFile = this.Configuration.get<boolean>("application.configuration.assembleCurrentAsmFile", true);
		if (doCurrentEditorFile && vscode.window.activeTextEditor) {
			let currentEditorFileExt = path.extname(vscode.window.activeTextEditor.document.uri.path).toLocaleLowerCase();
			if (this.Extensions.find(ex => ex === currentEditorFileExt)) {
				// The current editor file is an assembler file
				return path.basename(vscode.window.activeTextEditor.document.uri.path);
			}
		}
		// 3. Find the first assembler file in the folder
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			const rootPath = vscode.workspace.workspaceFolders[0].uri;

			var potential = [];
			for (const [name, type] of await vscode.workspace.fs.readDirectory(rootPath)) {
				if (type === vscode.FileType.File) {
					// Only look at files
					let extension = path.extname(name).toLocaleLowerCase();
					if (this.Extensions.find(ex => ex === extension)) {
						// Yes have an assembler file
						let uriPath = vscode.Uri.file(path.join(rootPath.path, name));
						const stat = await vscode.workspace.fs.stat(uriPath);
						potential.push({fn: name, tm: stat.mtime});
					}
				}
			}
			// If there is only one entry. Easy take it
			if (potential.length === 1) {
				return potential[0].fn;
			}
			// Sort based on filename or last modified date
			let sortBy = this.Configuration.get<string>("application.configuration.findFirstFileBy", "Filename").trim();

			let comparer = sortBy === "Filename" ? ((a:any,b:any) => {
				if (a.fn < b.fn) {return -1};
				if (a.fn > b.fn) {return 1};
				return 0;
			} ): ((a:any,b:any) => b.tm - a.tm);

			potential.sort(comparer);

			// Take the first entry
			return potential[0].fn;
		}
		return "code.asm";
	}

	// ------------------------------------------------------------------------
	// Code that needs to be overridden by the specific assembler runner
	protected abstract InitOriginalPath(): void;
	protected abstract InitialiseAsync(): Promise<boolean>;
	protected abstract ExecuteAssemblerAsync(): Promise<boolean>;
	protected abstract InitGetAssemblerCommandLineGetter(): void;
	protected abstract GetAssemblerCommandLineDirectly(thisAsmFile: string): Promise<string[]>;
	protected abstract GetAssemblerCommandLineFromBuildInfo(): Promise<string[]>;
	public abstract FixExecPermissions(): Promise<void>;
}