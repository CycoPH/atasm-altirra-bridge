/* eslint-disable @typescript-eslint/naming-convention */
"use strict";
import * as path from 'path';
import * as vscode from 'vscode';
import * as application from '../application';
import * as filesystem from '../filesystem';
import * as execute from '../execute';

export class EmulatorRunner implements vscode.Disposable {
	// Features
	public IsRunning: boolean = false;

	protected Configuration: vscode.WorkspaceConfiguration | undefined;

	// Features
	public readonly Name: string = "Altirra";
	public FullPathToAltirra: string = "";
	public Args: string = "";
	public Region: string = "";
	public Debugger: boolean = false;
	public AutoCloseAltirra: boolean = false;
	protected FileName: string = "";

	// Lists (to match settings)
	protected readonly RegionList: Map<string, string> = new Map([
		["NTSC", "/ntsc"],
		["PAL", "/pal"],
	]);

	public dispose(): void {
	}

	public async RunGameAsync(fileName: string): Promise<boolean> {
		// Set
		this.FileName = fileName;

		// Process
		let result = await this.InitialiseAsync();
		if (!result) { return false; }

		return await this.ExecuteEmulatorAsync();
	}

	public async RunDebuggerAsync(fileName: string): Promise<boolean> {
		// Set
		this.FileName = fileName;

		// Process
		let result = await this.InitialiseAsync();
		if (!result) { return false; }

		this.Debugger = true;
		return await this.ExecuteEmulatorAsync();
	}

	protected async ExecuteEmulatorAsync(): Promise<boolean> {

		// Prepare
		application.CompilerOutputChannel.appendLine('');

		// Args
		// Make sure we send nodebug where config is being saved
		let args = [
			this.Region,
			`/run "${this.FileName}"`,
			this.Args
		];
		if (this.Debugger) {
			args.push("/debug");
			args.push("/debugcmd:.loadsym");
		}

		// Command
		let command = `"${this.FullPathToAltirra}"`;
		let exec = path.parse(this.FullPathToAltirra).base;

		if (this.AutoCloseAltirra) {
			await execute.KillProcessByNameAsync(exec, this.FullPathToAltirra);
		}

		// Process
		application.CompilerOutputChannel.appendLine(`Launching ${this.Name} emulator...`);

		// Launch
		let executeResult = await execute.Spawn(command, args, null, application.WorkspaceFolder,
			(stdout: string) => {
				// Prepare
				let result = true;

				// Result
				application.CompilerOutputChannel.append('' + stdout);
				return result;
			},
			(stderr: string) => {
				// Prepare
				let result = true;

				// Result
				application.CompilerOutputChannel.append('' + stderr);
				return result;
			});

		// Result
		return executeResult;
	}

	protected async InitialiseAsync(): Promise<boolean> {
		// Configuration
		let result = await this.LoadConfigurationAsync();
		if (!result) { return false; }

		// Result
		return true;
	}

	protected async RepairFilePermissionsAsync(): Promise<boolean> {
		return true;
	}

	protected async LoadConfigurationAsync(): Promise<boolean> {
		// Reset
		this.FullPathToAltirra = "altirra64.exe";
		this.Args = "";
		this.Region = "";
		this.Debugger = false;

		// (Re)load
		// It appears you need to reload this each time in case of a change
		this.Configuration = application.GetConfiguration();

		// Emulator
		let altirraPath = this.Configuration.get<string>("emulator.altirra.path");
		if (!altirraPath || altirraPath.trim().length === 0) {
			vscode.commands.executeCommand('workbench.action.openSettings', application.Name + ".emulator.altirra.path");
			let message = `WARNING: Please set the path to your Altirra installation!`;
			application.WriteToCompilerTerminal(message);
			application.WriteToCompilerTerminal("");
			application.ShowWarningPopup(message);
			return false;
		}
		this.FullPathToAltirra = altirraPath;

		// Validate (user provided)
		let result = await filesystem.FileExistsAsync(altirraPath);
		if (!result) {
			// Notify
			let message = `WARNING: Your chosen Altirra emulator path '${altirraPath}' cannot be found.\Please set the path in the settings...`;
			vscode.commands.executeCommand('workbench.action.openSettings', application.Name + ".emulator.altirra.path");
			application.WriteToCompilerTerminal(message);
			application.WriteToCompilerTerminal("");
			application.ShowWarningPopup(message);
		}
		
		// Emulator
		this.Args = this.Configuration.get<string>("emulator.altirra.args", "");

		this.AutoCloseAltirra = this.Configuration.get<boolean>("emulator.altirra.autoCloseRunningAltirra", true);

		let userRegion = this.Configuration!.get<string>("emulator.altirra.region", "");
		if (userRegion) {
			// Confirm from list
			for (let [name, id] of this.RegionList) {
				if (name === userRegion) {
					this.Region = id;
					break;
				}
			}
		}

		// Result
		return true;
	}
}
