/* eslint-disable @typescript-eslint/naming-convention */
"use strict";
import * as vscode from 'vscode';
import * as application from './application';
import { kill } from "process";
const cp = require("child_process");
const find = require("find-process");

export async function KillProcessByNameAsync(name: string, withPath: string): Promise<void> {
	// Need to lowercase name
	if (application.IsLinux || application.IsMacOS) { name = name.toLowerCase(); }

	// Search
	await find('name', name)
		.then(function (list: any) {
			//console.log(list);
			for (let process of list) {
				if (process?.name.toLowerCase() === name.toLowerCase()) {
					KillProcessById(process?.pid);
				}
			}
		}, function (err: any) {
			console.log(err.stack || err);
		});
}

export function KillProcessById(pid: any): void {
	// Validate
	if (pid === undefined) { return; }

	// Process
	try {
		// Try and kill any child process
		let kill = require('tree-kill');
		kill(pid);
	} catch (error) {
		console.log(`Failed to kill process ${pid}`);
	}
}

export function KillSpawnProcess(): void {
	// Process
	KillProcessById(cp?._process?.id);
}

export function JustRun(command: string, args: string[] | null, cwd: string): Promise<boolean> {
	return new Promise((resolve, reject) => {
		// prepare
		let receivedError = false;

		let ca = cp.spawn(command, args, {
			cwd: cwd,
			detached: true,
			stdio: 'ignore'
		});

		ca.on('error', (err: any) => {
			return resolve(false);
		});

		ca.on("close", (e: any) => {
			return resolve(true);
		});
	});
}

export function Spawn(command: string, args: string[] | null, env: { [key: string]: string | null } | null, cwd: string, stdout: any, stderr: any): Promise<boolean> {

	// Process
	return new Promise((resolve, reject) => {
		// prepare
		let receivedError = false;

		let ca = cp.spawn(command, args, {
			shell: true,
			env: env,
			cwd: cwd
		});

		// Capture output
		ca.stdout.on('data', (data: { toString: () => ""; }) => {
			// Prepare
			let message = data.toString();

			// Send out
			var result = stdout(message);
			if (!result) { receivedError = true; }

			// Notify
			//console.log('- stdout ');
			//console.log(message);
		});
		ca.stderr.on('data', (data: { toString: () => ""; }) => {
			// Prepare
			let message = data.toString();

			// Send out
			var result = stderr(message);
			if (!result) { receivedError = true; }

			// Notify
			//console.log('- stderr ');
			//console.log(message);
		});

		// Error?
		ca.on('error', (err: any) => {
			// console.log(`- error '${err}'`);
			return resolve(false);
		});

		// Complete
		ca.on("close", (e: any) => {
			// Validate
			let result = e;
			if (receivedError && result === 0) { result = 1; }

			// Exit code?
			if (result !== 0) { stdout(`Exit code: ${result}`); }

			// Finalize and exit
			return resolve(result === 0);
		});

	});
}