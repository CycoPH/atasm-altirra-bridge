import * as vscode from 'vscode';
import * as application from '../application';
import { createHash } from "crypto";

export class MemoryViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'atasm.memoryViewer';

	private _view?: vscode.WebviewView;

	private buildDataCache: any;

	public buildData : String;
	public extContext : vscode.ExtensionContext | undefined;
	public extOutput : vscode.OutputChannel | undefined;
	public webviewView : vscode.WebviewView | undefined;

	constructor(private readonly _extensionUri: vscode.Uri) {
		this.buildData = "";
		this.buildDataCache = new Object();
	}

	public setBuildDataCache(path:string, data:string) {
		this.buildData = data;
		this.viewCreate(data);
		let hash = createHash('md5').update(path).digest('hex');
		this.buildDataCache[hash] = data; 
	}
	
	public getBuildDataCache(path:string) {
		let hash = createHash('md5').update(path).digest('hex');
		return this.buildDataCache[hash] || false;
	}

	public resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken) {

		this._view = webviewView;
		this.webviewView = webviewView;

		webviewView.webview.options = {

			enableScripts: true,
			localResourceRoots: [
				this._extensionUri
			]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.onDidChangeVisibility(event => {
			if (webviewView.visible) {
				setTimeout(() => {
					this.viewInit();
					this.viewCreate(this.buildData);
				},1000);
			}
		});

		webviewView.onDidDispose(event => {
		});

		if (this.buildData) {
			this.viewCreate(this.buildData);
		}

		webviewView.webview.onDidReceiveMessage(buildData => {

			switch (buildData.command) {
			}
			
		});
	}


	private viewCreate(output: any) {

		var _settings = application.GetConfiguration();
		this.buildData = output;

		var _package = Object.create( {} );

		_package.output = output;
		_package.size = _settings.get("viewer.memory.size");
		_package.showRoms = _settings.get("viewer.memory.roms");

		if (this._view) {
			this._view.webview.postMessage({ type: 'view_create', data: _package });
		}
	}

	public viewInit() {

		var _settings = application.GetConfiguration();

		var _package = Object.create( {} );

		_package.size = _settings.get("viewer.memory.size");
		_package.showRoms = _settings.get("viewer.memory.roms");
	
		if (this._view) {
			this._view.webview.postMessage({ type: 'view_init', data: _package });
		}
	}

	public viewRefresh() {

		if (this._view) {
			this._view.webview.postMessage({ type: 'view_refresh' });
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) {

		const jQueryJs = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'client/media', 'jquery-3.6.0.min.js'));

		const createJs = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'client/media', 'createjs.js'));

		const zimJs = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'client/media', 'zim.js'));

		const memoryViewJs = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'client/media', 'memoryViewProvider.js'));

		const memoryViewCss = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'client/media', 'memoryViewProvider.css'));

		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<title>Atasm Assembler Memory Viewer</title>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->

				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${memoryViewCss}" rel="stylesheet">

			</head>
			<body>
				<div id="test"/>
				<script nonce="${nonce}"></script>
				<script type="text/javascript" nonce="${nonce}" src="${jQueryJs}"></script>
				<script type="text/javascript" nonce="${nonce}" src="${createJs}"></script>
				<script type="text/javascript" nonce="${nonce}" src="${zimJs}"></script>
				<script type="text/javascript" nonce="${nonce}" src="${memoryViewJs}"></script>
			</body>
			</html>`;
	}
}

function getNonce() {

	let _nonce = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

	for (let i = 0; i < 32; i++) {
		_nonce += possible.charAt(Math.floor(Math.random() * possible.length));
	}

	return _nonce;
}
