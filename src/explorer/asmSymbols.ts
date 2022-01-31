import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class AsmSymbolProvider implements vscode.TreeDataProvider<AsmSymbolInfo> {

	private _onDidChangeTreeData: vscode.EventEmitter<AsmSymbolInfo | undefined | void> = new vscode.EventEmitter<AsmSymbolInfo | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<AsmSymbolInfo | undefined | void> = this._onDidChangeTreeData.event;

	constructor(private workspaceRoot: string | undefined) {
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: AsmSymbolInfo): vscode.TreeItem {
		return element;
	}

	getChildren(element?: AsmSymbolInfo): Thenable<AsmSymbolInfo[]> {
		if (!this.workspaceRoot) {
			vscode.window.showInformationMessage('No asm symbols in empty workspace');
			return Promise.resolve([]);
		}

		if (element) {
			return Promise.resolve(this.getInfoFromAsmSymbolsJson(path.join(this.workspaceRoot, 'asm-symbols.json'), element ) );
		} else {
			const asmSymbolsJsonPath = path.join(this.workspaceRoot, 'asm-symbols.json');
			if (this.pathExists(asmSymbolsJsonPath)) {
				return Promise.resolve(this.getInfoFromAsmSymbolsJson(asmSymbolsJsonPath, undefined) );
			} else {
				vscode.window.showInformationMessage('Workspace has no asm-symbols.json');
				return Promise.resolve([]);
			}
		}
	}

	private makeConstant = (one: any) => {
		// This is a constant
		//	.name = Label in the assembler
		//	.addr = Where in memory the label is located
		//	.file & .ln = Where is the source code the label is defined
		const tip = one.file + " ln:" + one.ln;
		const addr = Number(one.addr);
		var addrStr:string;

		if (addr < 256) {
			addrStr = `\$${addr.toString(16).padStart(2, '0')} / ${addr}`;
		} else {
			addrStr = `\$${addr.toString(16).padStart(4, '0')}`;
		}

		return new AsmSymbolInfo("constants", one.name, `= ${addrStr}`, vscode.TreeItemCollapsibleState.None, tip, {
						command: 'extension.openSourceAtLine',
						title: '',
						arguments: [{file:one.file, ln:one.ln, loc:this.workspaceRoot}]
					});
	};

	private makeLabel = (label: any) => {
		// This is a label
		//	.name = Label in the assembler
		//	.addr = Where in memory the label is located
		//	.file & .ln = Where is the source code the label is defined
		//	.cmdln = Label was defined on the command line
		if (label.cmdln) {
			// Command line entry, no command, no goto source
			return new AsmSymbolInfo("constants", label.cmdln, "from command line", vscode.TreeItemCollapsibleState.None);
		}
		// Not a command line entry but one from source code
		const info = `@ \$${Number(label.addr).toString(16).padStart(4, '0')} ${label.file} ln:${label.ln}`;
		return new AsmSymbolInfo("labels", label.name, info, vscode.TreeItemCollapsibleState.None, undefined, {
						command: 'extension.openSourceAtLine',
						title: '',
						arguments: [{file:label.file, ln:label.ln, loc:this.workspaceRoot}]
					});
	};

	private makeMacro = (macros: any) => {
		// This is a macro
		//	.name = name in the assembler
		//	.file & .ln = Where is the source code the macro is defined
		const info = macros.file + " ln:" + macros.ln;
		return new AsmSymbolInfo("macros", macros.name, info, vscode.TreeItemCollapsibleState.None, undefined, {
						command: 'extension.openSourceAtLine',
						title: '',
						arguments: [{file:macros.file, ln:macros.ln, loc:this.workspaceRoot}]
					});
	};
	
	private makeInclude = (theInclude: any) => {
		// This is an include file
		//	.file = Where is the source code
		return new AsmSymbolInfo("includes", theInclude.file, undefined, vscode.TreeItemCollapsibleState.None, undefined, {
						command: 'extension.openSourceAtLine',
						title: '',
						arguments: [{file:theInclude.file, ln:1, loc:this.workspaceRoot}]
					});
	};
	

	/**
	 * Given the path to asm-symbols.json, read all its "constants", "labels".
	 */
	private getInfoFromAsmSymbolsJson(asmSymbolsJsonPath: string, element?: AsmSymbolInfo) : AsmSymbolInfo[] {
		if (this.pathExists(asmSymbolsJsonPath)) {
			// Create the root elements
			if (element === undefined) {
				return [
					new AsmSymbolInfo("constants", "Constants", undefined, vscode.TreeItemCollapsibleState.Collapsed),
					new AsmSymbolInfo("labels", "Labels", "Sorted by address", vscode.TreeItemCollapsibleState.Collapsed),
					new AsmSymbolInfo("labelsAZ", "Labels", "Alphabetical", vscode.TreeItemCollapsibleState.Collapsed),
					new AsmSymbolInfo("labelsSRC", "Labels", "By source file", vscode.TreeItemCollapsibleState.Collapsed),
					new AsmSymbolInfo("macros", "Macros", undefined, vscode.TreeItemCollapsibleState.Collapsed),
					new AsmSymbolInfo("includes", "Includes", undefined, vscode.TreeItemCollapsibleState.Collapsed),
				];
			}

			const asmSymbolJson = JSON.parse(fs.readFileSync(asmSymbolsJsonPath, 'utf-8'));

			switch (element.context) {
				case "labels": {
					return asmSymbolJson.labels
						? asmSymbolJson.labels.map( (label: any) => this.makeLabel(label))
						: [];
				}

				case "labelsAZ": {
					return asmSymbolJson.labels
						? asmSymbolJson.labels.sort((a:any,b:any) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0)).map( (label: any) => this.makeLabel(label))
						: [];
				}

				case "labelsSRC": {
					const srcFiles = asmSymbolJson.labels
						? asmSymbolJson.labels.map((it: { file: string; }) => it.file).sort()
						: [];
					const unique = [... new Set(srcFiles)];
					return unique.map( it => new AsmSymbolInfo("labelsLimit", ""+it, undefined, vscode.TreeItemCollapsibleState.Collapsed, undefined, undefined, "includes") );
				}

				case "labelsLimit": {
					// Only show labels that belong to a specific source file
					return asmSymbolJson.labels.filter((it: { file: string; }) => it.file === element.label).sort((a:any,b:any) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0)).map( (it: any) => this.makeLabel(it));
				}

				case "macros": {
					return asmSymbolJson.macros
						? asmSymbolJson.macros.sort((a:any,b:any) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0)).map( (macro: any) => this.makeMacro(macro))
						: [];
				}

				case "includes": {
					return asmSymbolJson.includes
						? asmSymbolJson.includes.sort((a:any,b:any) => (a.file > b.file) ? 1 : ((b.file > a.file) ? -1 : 0)).map( (fn: any) => this.makeInclude(fn))
						: [];
				}

				case "constants": {
					if (!asmSymbolJson.constants || (asmSymbolJson.constants && asmSymbolJson.constants.length === 0)) {
						return [
							new AsmSymbolInfo("constants", "None", "defined in the source code", vscode.TreeItemCollapsibleState.None)
						];
					}
					// Make the two sub-selection menu items
					return [
						new AsmSymbolInfo("constantsAZ", "Alphabetically", undefined, vscode.TreeItemCollapsibleState.Collapsed, undefined, undefined, "az"),
						new AsmSymbolInfo("constantsSRC", "By source file", undefined, vscode.TreeItemCollapsibleState.Collapsed, undefined, undefined, "includes"),
					];
				}

				case "constantsAZ": {
					const them = asmSymbolJson.constants
						? asmSymbolJson.constants.sort((a:any,b:any) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0)).map( (it: any) => this.makeConstant(it))
						: [];
					return them;
				}
				case "constantsSRC": {
					const srcFiles = asmSymbolJson.constants
						? asmSymbolJson.constants.map((it: { file: string; }) => it.file).sort()
						: [];
					const unique = [... new Set(srcFiles)];
					return unique.map( it => new AsmSymbolInfo("constantsLimit", ""+it, undefined, vscode.TreeItemCollapsibleState.Collapsed, undefined, undefined, "includes") );
				}
				case "constantsLimit": {
					// Only show constants that belong to a specific source file
					return asmSymbolJson.constants.filter((it: { file: string; }) => it.file === element.label).sort((a:any,b:any) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0)).map( (it: any) => this.makeConstant(it));
				}
			}

			return [];
		} else {
			return [];
		}
	}

	/**
	 * Check if a file can be accessed.
	 * @param p Path to the file to check
	 * @returns true if the file exists, false otherwise
	 */
	private pathExists(p: string): boolean {
		try {
			fs.accessSync(p);
		} catch (err) {
			return false;
		}

		return true;
	}
}

const iconPaths:any = {
	"az": {
		light: path.join(__filename, '..', '..', 'resources', 'light', 'asm-az.svg'),
		dark: path.join(__filename, '..', '..', 'resources', 'dark', 'asm-az.svg')
	},
	"constants": {
		light: path.join(__filename, '..', '..', 'resources', 'light', 'asm-constants.svg'),
		dark: path.join(__filename, '..', '..', 'resources', 'dark', 'asm-constants.svg')
	},
	"includes": {
		light: path.join(__filename, '..', '..', 'resources', 'light', 'asm-includes.svg'),
		dark: path.join(__filename, '..', '..', 'resources', 'dark', 'asm-includes.svg')
	},
	"labels": {
		light: path.join(__filename, '..', '..', 'resources', 'light', 'asm-labels.svg'),
		dark: path.join(__filename, '..', '..', 'resources', 'dark', 'asm-labels.svg')
	},
	"labelsAZ": {
		light: path.join(__filename, '..', '..', 'resources', 'light', 'asm-labelsAZ.svg'),
		dark: path.join(__filename, '..', '..', 'resources', 'dark', 'asm-labelsAZ.svg')
	},
	"labelsSRC": {
		light: path.join(__filename, '..', '..', 'resources', 'light', 'asm-includes.svg'),
		dark: path.join(__filename, '..', '..', 'resources', 'dark', 'asm-includes.svg')
	},
	"macros": {
		light: path.join(__filename, '..', '..', 'resources', 'light', 'asm-macros.svg'),
		dark: path.join(__filename, '..', '..', 'resources', 'dark', 'asm-macros.svg')
	},
};

/**
 * Object to represent a single symbol entry
 */
export class AsmSymbolInfo extends vscode.TreeItem {

	constructor(
		public readonly context: string,
		public readonly label: string,
		private readonly desc: string | undefined,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		private readonly tip?: string,
		public readonly command?: vscode.Command,
		icon?: string
	) {
		super(label, collapsibleState);

		if (this.tip) {
			this.tooltip = this.tip;
		}
		this.description = this.desc;
		this.contextValue = context;

		const iconFN:string = icon ? icon : context;
		this.iconPath = iconPaths[iconFN];
	}
}
