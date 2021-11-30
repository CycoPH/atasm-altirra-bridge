# ATasm Altirra Bridge - write 6502, assemble, run and debug all in one
This extension lets you code your Atari 8 bit assembler projects using a modern tool chain.

Write in VSCode and use the status bar icons or keyboard shortcuts to assemble, run and debug your project. Set breakpoints and debug with ease.

## Features
This extension includes the following features:
* 6502 assembler syntax highlighting
* Cross-platform macro assembler (ATasm)
* Run your code in the Altirra emulator (or setup another one)
* Source level debugging with breakpoints

## Syntax Highlighting
![Syntax Highlighting](images/syntax.png)

## Build tasks and shortcuts for building you assembler projects
The extension registers build tasks for 6502 assembly files which invoke `ATasm` on the file
currently beind edited (Ctrl + Shift + B). 
If you have a `atasm-build.json` configuration file in your workspace folder then a task will be created for the defined project. ![Build Tasks](images/tasks.png)

The build tasks allow you to quickly assemble your code.  By default output goes to the `out` folder with a `.xex` extension.

## ATasm/Altirra
For a full integration with the `Altirra` emulator you need to create the `atasm-build.json` configuration file. This allows you to optionally specify the name of the input file which is passed to the assembler as well as any additional parameters.

```json
{
	"input": "theapp.asm",
	"includes": ["music"],
	"outputFolder": "out",
	"params": "-v",
	"symbols": ["TEST=1"],
	"withDebug": true
}
```

There is no need to create this file by hand.  You can use the status bar shortcut buttons:
![Statusbar](images/Statusbar.png) 

or the command pallette (Ctrl+Shift+P then type atasm)
![Commands](images/cmds.png)

to create the file.

Pressing the gear icon will create and open the configuration file.
- `input` - the first file in your project.  This will `.include` all others. `theapp.asm` by default.  Change this to the name of your game or application.
- `includes` - a list of folders that will be searched for files when they are included.
- `outputFolder` - the location relative to your workspace where the assembler output will be written to.  This is `out` by default.
- `params` - The extra ATasm parameters you want to specify. i.e. -v for verbose output
- `symbols` - An array of predefined symbol definitions. i.e ["VERSION=1","TEST=0"]
- `withDebug` - Boolean value of `true` will create a symbol and listing file that will help with Altirra debugging.

### Build
The VSCode status bar allows for quick access to the `Build` (Shift + F5), `Build and Run` (F5), and `Build and Debug` (Ctrl + F5) commands.

The build ![Build](images/build.png) button will run ATasm with the configured parameters.  Output and status messages go to the `OUTPUT` console. 

![Output](images/output.png)

### Build and Run
The first time the build and run ![Run](images/run.png) button is pressed the extension will verify if `Altirra` (or another emulator) has been setup and its location on the machine configured. It its not configured then the following screen will be shown. Enter the location of your Altirra emulator location including the executable filename. i.e. D:\Altirra\3.90\Altirra64.exe or /usr/bin/altirra/wine-altirra

![Altirra](images/altirra.png)

Once a reference to Altirra has been added you can run your project code directly from VSCode.

If your system does not allow you to run Altirra or you want to use another emulator you can confiure the path and command line for it.
![Own](images/own.png)

You need to supply all the arguments in the correct format, the extension would not know how to format the arguments. .i.e. Would an arguement start the --, -, or /.

### Build and Debug
The real power of the extension comes in the form of the Altirra debugger. Pressing the build and debug ![Debug](images/debug.png) button will not only create the binary file, but also a file containing the `symbol` definitions and a `list` file. The list file maps every line number of the project to a memory location. This allows us to do source level debugging and to set break points in the assembler code and have Altirra hit them when the program is executed.

Here is what source level debugging with a hit breakpoint looks like in Altirra

![Colors](images/colors.png)

## Installing and configuring

### ATasm and Altirra
A version of the [ATasm](https://github.com/CycoPH/atasm) macro assembler ships with this extension.

Altirra can be downloaded from [here](http://www.virtualdub.org/altirra.html). A description on how to configure it can be found in the [Retro Coding Blog](https://retro.cerebus.co.za/blog/asm/chapter1/).

### Updating the extension
Updates are regularly provided and you will be notified via VS Code when one has been made available. Once an update has been installed you will generally be prompted to restart VS Code.

## 6502 sample

```asm
; A simple test app to put some color on the screen
COLPF2 = $d018
COLBK = $D01A
WSYNC = $d40a
VCOUNT = $d40b
RTCLOK = $14

	* = $2000
BOOT_THIS
loop
	lda RTCLOK
	tay
	clc
	adc VCOUNT
	tax

	tya
	asl
	sec
	sbc VCOUNT

	sta WSYNC

	sta COLBK
	stx COLPF2
	jmp loop

	*=$2e0
	.word BOOT_THIS
```

## Requirements

The [Altirra](http://www.virtualdub.org/altirra.html) emulator needs to be installed to run and debug your code.

## Extension Settings

There are various settings that control aspects of this extension.  To access them open the settings (Ctrl+,) and select `Atasm Altirra Bridge` from the extensions

This extension contributes the following settings:

* `atasm-altirra-bridge.assembler.atasmPath`: If you wish to use your own version of ATasm (and not the one shipped with the extension) then set the path to it here
* `atasm-altirra-bridge.editor.clearPreviousOutput`: Whether to clear the previous output window everytime the assembler is triggered.
* `atasm-altirra-bridge.editor.saveAllFilesBeforeBuild`: Whether to save all files before build is triggered.
* `atasm-altirra-bridge.editor.saveFileBeforeBuild`: Whether to save the active file before build is triggered.
* `atasm-altirra-bridge.editor.showAssemblerOutput`: Whether to show the assembler messages in the output window.
* `atasm-altirra-bridge.editor.statusBarCommands`: Show information and feature short-cuts on the Status Bar.
* `atasm-altirra-bridge.emulator.altirra.path`: Specify the full path to the Altirra emulator.
* `atasm-altirra-bridge.emulator.altirra.args`: Specify (optional) Altirra command line arguments.
* `atasm-altirra-bridge.emulator.altirra.autoCloseRunningAltirra`: Automatically close any existing Altirra instances before opening a new one.
* `atasm-altirra-bridge.emulator.altirra.region`: Run Altirra in PAL or NTSC region
* `atasm-altirra-bridge.emulator.ownEmulator`: Whether to run Altirra or another emulator (own)
* `atasm-altirra-bridge.emulator.own.args`: All arguments passed to the own emulator. The extension does not add any.
* `atasm-altirra-bridge.emulator.own.path`: Full path to your own emulator.

## Known Issues

## Release Notes
### 1.5.0
- Atasm version bump to 1.13
- Atasm can now generate CC65 header and atasm include files from your project
  - use -hc switch to generate a CC65 header file
  - use -ha switch to generate an atasm include file

### 1.4.0
- Atasm version bump to 1.12

### 1.3.0
- MacOS support
- Added a MacOS x64 atasm executable

### 1.2.0
- Better integration of the ATasm assembler
- Fixed a bug that reset the path to be always the Windows path of the atasm
- Build Task now also works when 'atasm-build.json' is the currently open file
- Added configuration options to allow for another emulator to be used
  - Set the ownEmulator setting and supply the path and arguments
  - The extension will not add any parameters. You will need to supply them in the correct format.

