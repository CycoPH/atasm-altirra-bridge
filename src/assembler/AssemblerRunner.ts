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
	public DefaultAtasmBin: string = "";				// Where can the shipped atasm be found?
	public BuildConfig: application.AtasmConfigurationDefinition | undefined = undefined;
	public WorkspaceFolder: string = "";

	private AtasmPath: string = "atasm";

	// These are items the emulator is interested in
	public InputFileName: string = "";					// The file being compiled (the input)
	public InputFileNameBase: string = "";				// Just the name part of the input, without the extension
	public OutputFolder: string = "";					// Where will all the output go
	public OutputFileName: string = "";					// The path and name of the assembled file
	public OutputSymbolsFileName: string = "";
	public OutputListFileName: string = "";
	public OutputBreakpoints: string = "";				// The file that set breakpoints will be written to
	public OutputDebugCmds: string = "";				// Altirra debug commands to set breakpoints

	private HaveDonePermissionCheck: boolean = false;

	constructor() {
		this.InitOriginalPath();
	}

	public dispose(): void {
	}

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

	// ----------------------------------------------------------------------------------
	// Internal code
	// ----------------------------------------------------------------------------------
	
	/**
	 * Build assembler command line from atasm-build.json configuration
	 * @returns array of command line arguments. [0] is the assembler [1..] are the parameters
	 */
	private async GetAssemblerCommandLineFromBuildInfo(): Promise<string[]> {
		let args: string[] = [];

		if (!await application.EnsureBuildConfigIsLoaded()) { return args; }

		this.BuildConfig = application.GetBuildConfig();
		if (!this.BuildConfig) { return args; }

		// Get the filename where the compiling starts.
		// If its undefined or blank then use the default
		this.InputFileName = (this.BuildConfig.input && this.BuildConfig.input.trim().length > 0)  ? this.BuildConfig.input : "theapp.asm";
		this.InputFileNameBase = path.parse(this.InputFileName).name;

		// Set where the assembler output goes or default to "out"
		this.OutputFolder = path.join("",
			(this.BuildConfig.outputFolder && this.BuildConfig.outputFolder.trim().length > 0) ? this.BuildConfig.outputFolder : "out"
		);

		// Create the filenames of all the outputs
		this.OutputFileName = `"${path.join(this.OutputFolder, this.InputFileNameBase + ".xex")}"`;
		this.OutputSymbolsFileName = `"${path.join(this.OutputFolder, this.InputFileNameBase + ".lab")}"`;
		this.OutputListFileName = `"${path.join(this.OutputFolder, this.InputFileNameBase + ".lst")}"`;
		this.OutputBreakpoints = path.join(this.OutputFolder, this.InputFileNameBase + ".brk");
		this.OutputDebugCmds = path.join(this.OutputFolder, this.InputFileNameBase + ".atdbg");

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

		args.push(`"${this.InputFileName}"`);

		return args;
	}

	/**
	 * Build assembler command line from defaults and the input asm file
	 * @param thisAsmFile Name of the file to assemble
	 * @returns array of command line arguments. [0] is the assembler [1..] are the parameters
	 */
	private async GetAssemblerCommandLineDirectly(thisAsmFile: string): Promise<string[]> {
		this.InputFileName = thisAsmFile.length > 0 ? thisAsmFile : "theapp.asm";
		this.InputFileNameBase = path.parse(this.InputFileName).name;

		this.OutputFolder = path.join("", "out");

		this.OutputFileName = `"${path.join(this.OutputFolder, this.InputFileNameBase + ".xex")}"`;
		this.OutputSymbolsFileName = `"${path.join(this.OutputFolder, this.InputFileNameBase + ".lab")}"`;
		this.OutputListFileName = `"${path.join(this.OutputFolder, this.InputFileNameBase + ".lst")}"`;
		this.OutputBreakpoints = path.join(this.OutputFolder, this.InputFileNameBase + ".brk");
		this.OutputDebugCmds = path.join(this.OutputFolder, this.InputFileNameBase + ".atdbg");

		// Build the command line
		let args: string[] = [];
		args.push(this.AtasmPath);

		// Output
		args.push(`-o${this.OutputFileName}`);

		args.push(`"${this.InputFileName}"`);

		return args;
	}

	/**
	 * Make sure that there is some AtasmPath configuration
	 */
	private InitGetAssemberCommandLineGetter() {
		this.InitOriginalPath();
		this.Configuration = application.GetConfiguration();
		this.WorkspaceFolder = this.GetWorkspaceFolder();

		if (this.Configuration) {
			let newAtasmPath = this.Configuration.get<string>(`assembler.atasmPath`, "").trim();
			this.AtasmPath = newAtasmPath?.length ? newAtasmPath : this.DefaultAtasmBin;
		}
		else {
			this.AtasmPath = this.DefaultAtasmBin;
		}
	}

	// ========================================================================
	private async ExecuteAssemblerAsync(): Promise<boolean> {
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

		args.push(`"${this.InputFileName}"`);

		// Environment
		let env: { [key: string]: string | null } = {};

		// Notify
		application.CompilerOutputChannel.appendLine(`Starting build ...`);
		application.CompilerOutputChannel.appendLine(command);
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
		if (executeResult) {
			executeResult = await this.VerifyCompiledFileSizeAsync();
		}

		// Result
		return executeResult;
	}

	private async InitialiseAsync(): Promise<boolean> {

		// Prepare
		let result = true;

		// Reset the atasm path and recheck everything
		this.InitOriginalPath();

		// (Re)load
		// It appears you need to reload this each time in case of a change
		this.Configuration = application.GetConfiguration();
		this.WorkspaceFolder = this.GetWorkspaceFolder();

		// Clear output content?
		// Note: need to do this here otherwise output from configuration is lost
		if (this.Configuration.get<boolean>(`editor.clearPreviousOutput`)) {
			application.CompilerOutputChannel.clear();
		}	
		
		// Activate output window?
		if (this.Configuration.get<boolean>(`editor.showAssemblerOutput`)) {
			application.CompilerOutputChannel.show();
		}

		// Possibly set the ATasm path from the VSCode configuration
		let newAtasmPath = this.Configuration.get<string>(`assembler.atasmPath`, "").trim();
		this.AtasmPath = newAtasmPath?.length ? newAtasmPath : this.DefaultAtasmBin;

		this.BuildConfig = application.GetBuildConfig();
		if (!this.BuildConfig) { return false; }

		// Get the filename where the compiling starts.
		// If its undefined or blank then use the default
		this.InputFileName = (this.BuildConfig.input && this.BuildConfig.input.trim().length > 0)  ? this.BuildConfig.input : "theapp.asm";
		this.InputFileNameBase = path.parse(this.InputFileName).name;

		// Set where the assembler output goes or default to "out"
		this.OutputFolder = path.join("",
			(this.BuildConfig.outputFolder && this.BuildConfig.outputFolder.trim().length > 0) ? this.BuildConfig.outputFolder : "out"
		);
		// Make sure the output folder exists
		if (!await this.MakeOutputFolder()) {
			application.WriteToCompilerTerminal(`Unable to create the output folder: ${this.OutputFolder}. This is always under the your workspace!`);
			return false;
		}

		// Create the filenames of all the outputs
		this.OutputFileName = path.join(this.OutputFolder, this.InputFileNameBase + ".xex");
		this.OutputSymbolsFileName = path.join(this.OutputFolder, this.InputFileNameBase + ".lab");
		this.OutputListFileName = path.join(this.OutputFolder, this.InputFileNameBase + ".lst");
		this.OutputBreakpoints = path.join(this.WorkspaceFolder, this.OutputFolder, this.InputFileNameBase + ".brk");
		this.OutputDebugCmds = path.join(this.WorkspaceFolder, this.OutputFolder, this.InputFileNameBase + ".atdbg");

		// Already running?
		if (this.IsRunning) {
			// Notify
			application.WriteToCompilerTerminal(`The assembler is already running! If you need to cancel the process use the 'atasm: Reset build process' option from the Command Palette.`);
			return false;
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

	/**
	 * 
	 * @returns boolean true if the files were found and non-zero lenght, false otherwise
	 */
	private async VerifyCompiledFileSizeAsync(): Promise<boolean> {
		// Verify created file(s)
		application.WriteToCompilerTerminal(`Verifying assembler output...`);

		let files = [this.OutputFileName];
		if (this.BuildConfig?.withDebug) {
			files.push(this.OutputSymbolsFileName);
			files.push(this.OutputListFileName);
		}

		let badFiles:string[] = [];
		let okFiles:string[] = [];

		let hasMissingFiles = false;
		for await (let fileToCheck of files) {
			// Validate
			let fileStats = await filesystem.GetFileStatsAsync(path.join(this.WorkspaceFolder, fileToCheck));
			if (fileStats && fileStats.size > 0) {
				okFiles.push(fileToCheck);
				continue;
			}
			if (fileStats) {
				// Empty output?
				application.WriteToCompilerTerminal(`WARNING: Assembler output is empty: '${fileToCheck}'`);
			}
			else {
				// Failed
				application.WriteToCompilerTerminal(`ERROR: Failed to create file: '${fileToCheck}'`);
			}
			badFiles.push(fileToCheck);

			hasMissingFiles = true;
		}
		if (okFiles.length) {
			application.WriteToCompilerTerminal(`Generated files:[${okFiles.join(", ")}] are ok`);
		}

		// Result
		return true;
	}

	/**
	 * Make sure that the designated output folder is created
	 * @returns boolean - true if the folder is there, false otherwise
	 */
	private async MakeOutputFolder(): Promise<boolean> {

		let folder = path.join(this.WorkspaceFolder, this.OutputFolder);
		if (!await filesystem.FolderExistsAsync(folder)) {
			// Not there, create it
			return await filesystem.MkDirAsync(folder);
		}

		return true;
	}

	private InitOriginalPath() {
		if (application.IsWindows) {
			// ATasm.exe is 32-bits so ignore the architecture
			this.DefaultAtasmBin = path.join(application.Path, "bin", application.OSPlatform, "atasm.exe");
		}
		else {
			this.DefaultAtasmBin = path.join(application.Path, "bin", application.OSPlatform, application.OSArch, "atasm");
		}
	}

	public async FixExecPermissions(): Promise<void> {
		if (!application.IsWindows) {
			await filesystem.ChModAsync(this.DefaultAtasmBin);
		}
	}
}