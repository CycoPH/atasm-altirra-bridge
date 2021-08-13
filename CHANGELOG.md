# Change Log

All notable changes to the "atasm-altirra-bridge" extension will be documented in this file.

## [1.3.0]
- MacOS support
- Added a MacOS x64 atasm executable

## [1.2.1] - 2021-05-27
- Fixed exec permission error on shipped version of ATasm

## [1.2.0] - 2021-05-27
- Better integration of the ATasm assembler
- Fixed a bug that reset the path to be always the Windows path of the atasm
- Build Task now also works when 'atasm-build.json' is the currently open file
- Added configuration options to allow for another emulator to be used
  - Set the ownEmulator setting and supply the path and arguments
  - The extension will not add any parameters. You will need to supply them in the correct format.

## [1.1.0] - 2021-05-26
- Added ATasm 64bit binary and made extension detect the platform and architecture
- Setting the Altirra path under Linux is now easier

## [1.0.0] - 2021-05-25
### Initial Release
- Basic functionality to assemble, run and debug 6502 assembler using ATasm and Altirra
- Placing breakpoints and running the code in Altirra with /debug is working
- Initial release with Windows support for ATasm and Altirra
- Some curated links to Atari 8-bit and 6502 introductions