/* eslint-disable @typescript-eslint/naming-convention */
"use strict";
import * as path from 'path';
import * as vscode from 'vscode';
import * as application from '../application';
import * as filesystem from '../filesystem';
import * as execute from '../execute';

export class EmulatorRunner implements vscode.Disposable {

	protected Configuration: vscode.WorkspaceConfiguration | undefined;

	// Features
	public readonly Name: string = "Altirra";
	public FullPathToEmulator: string = "";
	public Args: string = "";
	public Region: string = "";
	public Debugger: boolean = false;
	public SingleInstance: boolean = false;
	public AutoCloseEmulator: boolean = false;
	protected FileName: string = "";
	private UseAltirra: boolean = true;

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

	// ----------------------------------------------------------------------------------
	// Internal code
	// ----------------------------------------------------------------------------------
	
	private async ExecuteEmulatorAsync(): Promise<boolean> {
		// Prepare
		application.CompilerOutputChannel.appendLine('');

		return (this.UseAltirra) ? (await this.RunAltirra() ) : ( await this.RunOwnEmulator() );
	}

	private async RunAltirra(): Promise<boolean> {

		// Args
		let args = [
			this.Region,
			`/run "${this.FileName}"`,
			this.Args
		];
		if (this.Debugger) {
			args.push("/debug");
			args.push("/debugcmd:.loadsym");
		}
		if (this.SingleInstance) {
			args.push("/singleinstance");
		}

		// Command
		let command = `"${this.FullPathToEmulator}"`;
		let exec = path.parse(this.FullPathToEmulator).base;

		if (this.AutoCloseEmulator && this.SingleInstance === false) {
			await execute.KillProcessByNameAsync(exec, this.FullPathToEmulator);
		}

		// Process
		application.CompilerOutputChannel.appendLine(`Launching emulator...`);
		application.CompilerOutputChannel.appendLine(command);
		application.CompilerOutputChannel.appendLine(args.join(" "));

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

	private async RunOwnEmulator(): Promise<boolean> {
		if (!this.Configuration) { return false; }

		// Args
		// Make sure we send nodebug where config is being saved
		let args:string[] = [];

		args.push(this.Configuration.get<string>("emulator.own.args", ""));

		// Command
		let command = this.Configuration.get<string>("emulator.own.path", "");
		if (!command || command?.length === 0) {return false;}

		// Process
		application.CompilerOutputChannel.appendLine(`Launching own emulator...`);
		application.CompilerOutputChannel.appendLine(command);
		application.CompilerOutputChannel.appendLine(args.join(" "));

		// Launch
		let executeResult = await execute.JustRun(command, args, application.WorkspaceFolder);

		// Result
		return executeResult;
	}



	/**
	 * Configure the path and parameters to the Altirra or own emulator
	 * @returns true if the setup is ok
	 */
	protected async InitialiseAsync(): Promise<boolean> {
		// (Re)load
		// It appears you need to reload this each time in case of a change
		this.Configuration = application.GetConfiguration();

		let own = this.Configuration.get<boolean>("emulator.ownEmulator", false);

		let result = own ? (await this.LoadOwnEmulatorConfigurationAsync() ) : (await this.LoadAltirraConfigurationAsync() );
		return result;
	}

	protected async LoadAltirraConfigurationAsync(): Promise<boolean> {
		if (!this.Configuration) { return false; }
		
		// Reset
		this.FullPathToEmulator = "altirra64.exe";
		this.Args = "";
		this.Region = "";
		this.Debugger = false;
		this.SingleInstance = false;
		this.UseAltirra = true;

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
		this.FullPathToEmulator = altirraPath;

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

		this.AutoCloseEmulator = this.Configuration.get<boolean>("emulator.altirra.autoCloseRunningAltirra", true);

		this.SingleInstance = this.Configuration.get<boolean>("emulator.altirra.singleInstance", false);

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


	protected async LoadOwnEmulatorConfigurationAsync(): Promise<boolean> {
		if (!this.Configuration) { return false; }
		
		// Reset
		this.FullPathToEmulator = "";
		this.Args = "";
		this.Region = "";
		this.Debugger = false;
		this.SingleInstance = false;
		this.UseAltirra = false;

		// Emulator
		let emulatorPath = this.Configuration.get<string>("emulator.own.path");
		if (!emulatorPath || emulatorPath.trim().length === 0) {
			vscode.commands.executeCommand('workbench.action.openSettings', application.Name + ".emulator.own.path");
			let message = `WARNING: Please set the path to your own emulator installation!`;
			application.WriteToCompilerTerminal(message);
			application.WriteToCompilerTerminal("");
			application.ShowWarningPopup(message);
			return false;
		}
		this.FullPathToEmulator = emulatorPath;

		// Validate (user provided)
		let result = await filesystem.FileExistsAsync(emulatorPath);
		if (!result) {
			// Notify
			let message = `WARNING: Your chosen emulator path '${emulatorPath}' cannot be found.\Please set the path in the settings...`;
			vscode.commands.executeCommand('workbench.action.openSettings', application.Name + ".emulator.altirra.path");
			application.WriteToCompilerTerminal(message);
			application.WriteToCompilerTerminal("");
			application.ShowWarningPopup(message);
		}
		
		this.Args = this.Configuration.get<string>("emulator.own.args", "");

		this.AutoCloseEmulator = false;

		// Result
		return true;
	}
}
