/* eslint-disable @typescript-eslint/naming-convention */
"use strict";
import * as vscode from 'vscode';
import * as path from 'path';
import * as application from '../application';
import * as filesystem from '../filesystem';
import * as execute from '../execute';

export class AssemblerRunner implements vscode.Disposable {
	// Features
	public IsRunning: boolean = false;

	protected Configuration: vscode.WorkspaceConfiguration | undefined;
	public readonly DefaultAtasmBin: string;			// Where can the shipped atasm.exe be found?
	public BuildConfig: application.AtasmConfigurationDefinition | undefined = undefined;
	public WorkspaceFolder: string = "";

	private AtasmPath: string = "atasm";

	// These are items the emulator is interested in
	public FileName: string = "";						// The file being compiled (the input)
	public FileNameBase: string = "";					// Just the name part of the input, without the extension
	public OutputFolder: string = "";					// Where will all the output go
	public OutputFileName: string = "";					// The path and name of the assembled file
	public OutputSymbolsFileName: string = "";
	public OutputListFileName: string = "";
	public OutputBreakpoints: string = "";				// The file that set breakpoints will be written to
	public OutputDebugCmds: string = "";				// Altirra debug commands to set breakpoints

	constructor() {
		if (application.IsWindows) {
			this.DefaultAtasmBin = path.join(application.Path, "bin", application.OSPlatform, "atasm.exe");
		}
		else {
			this.DefaultAtasmBin = path.join(application.Path, "bin", application.OSPlatform, application.OSArch, "atasm");
		}
	}

	public dispose(): void {
	}

	public async BuildGameAsync(): Promise<boolean> {

		// Initialise
		let result = await this.InitialiseAsync();
		if (!result) { return false; }

		// Execute
		return await this.ExecuteCompilerAsync();
	}

	public async GetAssemblerCommandLine(thisAsmFile: string | undefined): Promise<string> {
		this.InitGetAssemberCommandLineGetter();

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

	private async GetAssemblerCommandLineFromBuildInfo(): Promise<string[]> {
		let args: string[] = [];

		if (!await application.EnsureBuildConfigIsLoaded()) { return args; }

		this.BuildConfig = application.GetBuildConfig();
		if (!this.BuildConfig) { return args; }

		this.FileName = this.BuildConfig.input ? this.BuildConfig.input : "theapp.asm";
		this.FileNameBase = path.parse(this.FileName).name;

		let outputFolder = "out";
		if (this.BuildConfig.outputFolder) { outputFolder = this.BuildConfig.outputFolder; }
		this.OutputFolder = path.join("", outputFolder);

		this.OutputFileName = `"${path.join(this.OutputFolder, this.FileNameBase + ".xex")}"`;
		this.OutputSymbolsFileName = `"${path.join(this.OutputFolder, this.FileNameBase + ".lab")}"`;
		this.OutputListFileName = `"${path.join(this.OutputFolder, this.FileNameBase + ".lst")}"`;
		this.OutputBreakpoints = path.join(this.OutputFolder, this.FileNameBase + ".brk");
		this.OutputDebugCmds = path.join(this.OutputFolder, this.FileNameBase + ".atdbg");

		// Build the command line
		args.push(this.AtasmPath);

		if (this.BuildConfig?.params) {
			args.push(this.BuildConfig.params);
		}

		// Output
		args.push(`-o${this.OutputFileName}`);

		// Define own symbols
		if (this.BuildConfig?.symbols && this.BuildConfig?.symbols.length > 0) {
			this.BuildConfig.symbols.map(x => args.push(`-d${x}`));
		}
		// Debug output
		if (this.BuildConfig?.withDebug) {
			args.push(`-l${this.OutputSymbolsFileName}`);
			args.push(`-g${this.OutputListFileName}`);
		}

		args.push(`"${this.FileName}"`);

		return args;
	}

	private async GetAssemblerCommandLineDirectly(thisAsmFile: string): Promise<string[]> {
		this.FileName = thisAsmFile.length > 0 ? thisAsmFile : "theapp.asm";
		this.FileNameBase = path.parse(this.FileName).name;

		let outputFolder = "out";
		this.OutputFolder = path.join("", outputFolder);

		this.OutputFileName = `"${path.join(this.OutputFolder, this.FileNameBase + ".xex")}"`;
		this.OutputSymbolsFileName = `"${path.join(this.OutputFolder, this.FileNameBase + ".lab")}"`;
		this.OutputListFileName = `"${path.join(this.OutputFolder, this.FileNameBase + ".lst")}"`;
		this.OutputBreakpoints = path.join(this.OutputFolder, this.FileNameBase + ".brk");
		this.OutputDebugCmds = path.join(this.OutputFolder, this.FileNameBase + ".atdbg");

		// Build the command line
		let args: string[] = [];
		args.push(this.AtasmPath);

		// Output
		args.push(`-o${this.OutputFileName}`);

		args.push(`"${this.FileName}"`);

		return args;
	}

	private InitGetAssemberCommandLineGetter() {
		this.Configuration = application.GetConfiguration();
		this.WorkspaceFolder = this.GetWorkspaceFolder();
		this.SetupBasicAtasmPath();
	}

	private SetupBasicAtasmPath(): void {
		if (this.Configuration) {
			let newAtasmPath = this.Configuration.get<string>(`assembler.atasmPath`);
			this.AtasmPath = newAtasmPath?.length ? newAtasmPath : this.DefaultAtasmBin;
		}
		else {
			this.AtasmPath = this.DefaultAtasmBin;
		}
	}

	// ========================================================================
	private async ExecuteCompilerAsync(): Promise<boolean> {
		//console.log('debugger:Assembler.ExecuteCompilerAsync');

		let command = this.AtasmPath;

		// Arguments
		let args: string[] = [];

		//args.push("-v");
		if (this.BuildConfig?.params) {
			args.push(this.BuildConfig.params);
		}

		// Output
		args.push(`-o${this.OutputFileName}`);

		// Define own symbols
		if (this.BuildConfig?.symbols && this.BuildConfig?.symbols.length > 0) {
			this.BuildConfig.symbols.map(x => args.push(`-d${x}`));
		}

		// Setup include folders
		if (this.BuildConfig?.includes && this.BuildConfig.includes.length > 0) {
			this.BuildConfig.includes.map(x => args.push(`-I"${x}"`));
		}
		// Debug output
		if (this.BuildConfig?.withDebug) {
			args.push(`-l${this.OutputSymbolsFileName}`);
			args.push(`-g${this.OutputListFileName}`);
		}

		args.push(`"${this.FileName}"`);

		// Environment
		let env: { [key: string]: string | null } = {};

		// Notify
		application.CompilerOutputChannel.appendLine(`Starting build ...`);
		application.CompilerOutputChannel.appendLine(args.join(" "));

		// Process
		this.IsRunning = true;
		let executeResult = await execute.Spawn(command, args, env, this.WorkspaceFolder,
			(stdout: string) => {
				// Prepare
				let result = true;

				// Validate
				if (stdout.includes("Parse error:") || stdout.includes("error:")) {
					// Potential messages received (so far):
					// Parse error
					// Error: 

					// Failed
					result = false;
				}

				// Result
				application.CompilerOutputChannel.append('' + stdout);
				return result;
			},
			(stderr: string) => {
				// Prepare
				let result = true;

				// Validate
				if (stderr.includes("Permission denied")) {
					// Potential messages received (so far):
					// Permission denied

					// Failed
					result = false;
				}

				// Result
				application.CompilerOutputChannel.append('' + stderr);
				return result;
			});
		this.IsRunning = false;

		// Finalise
		if (executeResult) { executeResult = await this.VerifyCompiledFileSizeAsync(); }

		// Result
		return executeResult;
	}

	private async InitialiseAsync(): Promise<boolean> {

		// Prepare
		let result = true;

		// (Re)load
		// It appears you need to reload this each time incase of change
		this.Configuration = application.GetConfiguration();
		this.WorkspaceFolder = this.GetWorkspaceFolder();

		this.BuildConfig = application.GetBuildConfig();
		if (!this.BuildConfig) { return false; }

		let newAtasmPath = this.Configuration.get<string>(`assembler.atasmPath`);
		this.AtasmPath = newAtasmPath?.length ? newAtasmPath : this.DefaultAtasmBin;

		// Copy values out of the build config
		this.AtasmPath = this.DefaultAtasmBin;

		this.FileName = this.BuildConfig.input ? this.BuildConfig.input : "theapp.asm";
		this.FileNameBase = path.parse(this.FileName).name;

		let outputFolder = "out";
		if (this.BuildConfig.outputFolder) { outputFolder = this.BuildConfig.outputFolder; }
		this.OutputFolder = path.join("", outputFolder);

		// Make sure the output folder exists
		await this.MakeOutputFolder();

		this.OutputFileName = path.join(this.OutputFolder, this.FileNameBase + ".xex");
		this.OutputSymbolsFileName = path.join(this.OutputFolder, this.FileNameBase + ".lab");
		this.OutputListFileName = path.join(this.OutputFolder, this.FileNameBase + ".lst");
		this.OutputBreakpoints = path.join(this.WorkspaceFolder, this.OutputFolder, this.FileNameBase + ".brk");
		this.OutputDebugCmds = path.join(this.WorkspaceFolder, this.OutputFolder, this.FileNameBase + ".atdbg");

		// Clear output content?
		// Note: need to do this here otherwise output from configuration is lost
		if (this.Configuration.get<boolean>(`editor.clearPreviousOutput`)) {
			application.CompilerOutputChannel.clear();
		}

		// Already running?
		if (this.IsRunning) {
			// Notify
			application.WriteToCompilerTerminal(`The assembler is already running! If you need to cancel the process use the 'atasm: Kill build process' option from the Command Palette.`);
			return false;
		}

		// Activate output window?
		if (this.Configuration.get<boolean>(`editor.showAssemblerOutput`)) {
			application.CompilerOutputChannel.show();
		}

		// Remove old debugger files before build
		await this.RemoveOldOutputFilesAsync();

		return result;
	}

	/**
	 * Remove the files that the build process will (re-)produce
	 */
	private async RemoveOldOutputFilesAsync(): Promise<void> {
		let files = [
			path.join(this.WorkspaceFolder, this.OutputFileName),
			path.join(this.WorkspaceFolder, this.OutputSymbolsFileName),
			path.join(this.WorkspaceFolder, this.OutputListFileName),
			this.OutputBreakpoints,
			this.OutputDebugCmds,
		];

		for await (let fileToCheck of files) {
			// Validate
			if (await filesystem.FileExistsAsync(fileToCheck)) {
				await filesystem.RemoveFileAsync(fileToCheck);
			}
		}
	}

	private GetWorkspaceFolder(): string {
		// Workspace (last resort)
		if (vscode.workspace.workspaceFolders) {
			return vscode.workspace.workspaceFolders[0].uri.fsPath;
		}
		return "";
	}

	private async VerifyCompiledFileSizeAsync(): Promise<boolean> {
		//console.log('debugger:CompilerBase.VerifyCompiledFileSize');

		// Verify created file(s)
		application.WriteToCompilerTerminal(`Verifying compiled file(s)...`);

		let files = [this.OutputFileName];
		if (this.BuildConfig?.withDebug) {
			files.push(this.OutputSymbolsFileName);
			files.push(this.OutputListFileName);
		}

		for await (let fileToCheck of files) {
			// Validate
			let fileStats = await filesystem.GetFileStatsAsync(path.join(this.WorkspaceFolder, fileToCheck));
			if (fileStats && fileStats.size > 0) { continue; }

			// Failed
			application.WriteToCompilerTerminal(`ERROR: Failed to create compiled file '${fileToCheck}'.`);
			return false;
		}
		application.WriteToCompilerTerminal(`Generated files:[${files.join(", ")}] are ok`);

		// Result
		return true;
	}

	private async MakeOutputFolder(): Promise<boolean> {

		let folder = path.join(this.WorkspaceFolder, this.OutputFolder);
		if (!await filesystem.FolderExistsAsync(folder)) {
			// Not there, create it
			return await filesystem.MkDirAsync(folder);
		}

		return true;
	}
}