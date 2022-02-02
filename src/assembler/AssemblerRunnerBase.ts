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