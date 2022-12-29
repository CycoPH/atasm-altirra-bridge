/*
	Javascript Program That Builds a Memory View
*/

// the height of each memory segment label
const segmentHeight = 20;

// the size of each memory segment for allocation
var segmentSize = 512; // default

// color for memory segments
var memoryForegroundColor = "#FFFFFF";
var memoryBackgroundColor = "#A9CCE3";
var memoryBorderColor = "#34495E";
var memoryRollBackgroundColor = "#A9CCE3";
var memoryWidth = 48;

// color for program segments
var programForegroundColor;
var programBackgroundColor = "#D6DBDF";
var programBorderColor = "#34495E";
var programRollBackgroundColor = "#85929E";
var programWidth = 128;

// virtual segments
var virtualBackgroundColor = orange;

// bank zero color
var bank0BackgroundColor = "#F2F4F4";
var bank0BorderColor = "#34495E";

// rom colors
var romBackgroundColor = "#A9CCE3";
var romBorderColor = "#34495E"

// tooltip colors
var tooltipForegroundColor = "#34495E";
var tooltipBackgroundColor = "#D2B4DE";
var tooltipBorderColor = "#34495E";

// border width
var drawBorderWidth = 0.15;

// global vars
var frame;
var stage;
var stageW;
var stageH;

// parsed memory
var memoryData = [];

// rom memory
var memoryRom = [];
var showRoms = true;

/*
	Class: MemorySegment

	An Area of Memory that has a Top, Bottom and Name.

	For example, on the C64 the top of Memory is
	sometimes referred to as zero, or $0000. While
	the bottom might be referred to as 65536 or $ffff.
*/
class MemorySegment {
	constructor(top, bottom, text, virtual) {
		this.top = top;
		this.bottom = bottom;
		this.text = text;
		this.virtual = virtual;
	}
}

/*
	Draw a Memory Segment
	This draws the list of memory segments to show the entire 64K of the Atari.
	It is similar to those that you might see by developers who use a spreadsheet to
	manually identify their program memory locations.
*/
function drawMemorySegments(segments) {
	segments.forEach((segment, index) => {

		var _label = new Label({
			font: "Tahoma",
			text: segment.text,
			size: 12,
			color: memoryForegroundColor,
			bold: false,
			labelWidth: memoryWidth,
			labelHeight: segmentHeight,
			maxSize: 12
		});

		var _button = new Button({
			label: _label,
			width: memoryWidth,
			height: segmentHeight,
			borderWidth: drawBorderWidth,
			borderColor: memoryBorderColor,
			backgroundColor: memoryBackgroundColor,
			rollBackgroundColor: memoryRollBackgroundColor,
			corner: 0,
			shadowColor: -1,
		}).pos(0, index * segmentHeight);

		stage.addChild(_button);
	});
}

/*
	Draw all program segments
	This will draw a box with a label that defines an area of memory that has
	been segmented in the Developers code. It also includes a Tooltip that will
	show when the Developer moves the mouse over a defined area.
*/
function drawProgramSegments() {
	if (memoryData.length === 0) {
		return;
	}
	memoryData.forEach((segment, index) => {

		/*
			the height of the calculated segment will determine
			if we want to actually show the text when we draw
	
			the height we check against (14) was just determined by some
			trial and error and is a best guess based on the fact
			that we use a size of 12 when drawing, so we assume we can
			handle something with a 1 pixel buffer around it
	
			most of this is done by the zimjs framework so we are
			not 100% sure if this is the best way to do this, but
			for now it works
	
			the "labelWidth" property below controls the margin around the
			label that draws the text, as such it ultimately determines
			when a phrase will wrap to the next line. we chose to put
			that margin there so that text does not end up aligning
			with the box that is drawn around each value
		*/

		var _height = ((segmentHeight / segmentSize) * (segment.bottom - segment.top));
		var _text = segment.text;

		if (_height < 14) {
			_text = "";
		}

		var _label = new Label({
			font: "Tahoma",
			text: _text,
			size: 12,
			color: programForegroundColor,
			bold: false,
			lineWidth: programWidth,
			labelWidth: programWidth * 0.90, // 10% margin
			labelHeight: _height,
			maxSize: 12,
			align: "center",
			valign: "center",
		});

		var _backgroundColor = programBackgroundColor;

		if (segment.virtual) {
			_backgroundColor = programBackgroundColor.darken(0.5);
		}

		var _button = new Button({
			label: _label,
			width: programWidth,
			height: ((segmentHeight / segmentSize) * (segment.bottom - segment.top)),
			borderWidth: drawBorderWidth,
			borderColor: programBorderColor,
			backgroundColor: _backgroundColor,
			rollBackgroundColor: programRollBackgroundColor,
			corner: 0,
			shadowColor: -1,
		}).pos(memoryWidth, ((segmentHeight / segmentSize) * segment.top));

		/*
			these two event listeners will control the showing and hiding of the tip/label that
			is defined below
		*/
		_button.addEventListener("mouseover", function (event) {
			event.target.tip.pos(stage.mouseX + 20, stage.mouseY + 10).top();
			stage.update();
		});

		_button.addEventListener("mouseout", function (event) {
			event.target.tip.pos(-1000, -1000).bot();
			stage.update();
		});

		stage.addChild(_button);

		/*
			the tooltip is provided as a label that is
			hidden outside of the canvas, and then brought
			into view when the developer moves the mouse over
			a particular memory segment
		*/
		var _size = (segment.bottom - segment.top) + 1; // different + 1 to include starting position
		var _size_bytes = `(${_size} bytes)`;

		var _l = `${toHex(segment.top)} --- ${toHex(segment.bottom)}\n\n${_size_bytes}\n\n${segment.text}`;

		if (segment.virtual) {
			_l += `\n\n -- virtual --`;
		}

		var _tip = new Label({
			font: "Tahoma",
			align: "center",
			valign: "middle",
			color: tooltipForegroundColor,
			corner: 0,
			size: 12,
			text: _l,
			backgroundBorderWidth: drawBorderWidth,
			backgroundColor: tooltipBackgroundColor,
			backgroundBorderColor: tooltipBorderColor,
		}).pos(-1000, -1000);

		stage.addChild(_tip);

		// give a reference to the tooltip to the button object
		_button.tip = _tip;
	});
}

/**
 * Bank 0 of 64K
 * All other used memory segments are placed on top
 */
function drawBankZero() {
	var _label = new Label({text: ""});

	var _button = new Button({
		label: _label,
		width: programWidth,
		height: segmentHeight * (65536 / segmentSize),
		borderWidth: drawBorderWidth,
		borderColor: bank0BorderColor,
		backgroundColor: bank0BackgroundColor,
		rollBackgroundColor: bank0BackgroundColor,
		corner: 0,
		shadowColor: -1,
	}).pos(memoryWidth, 0);

	stage.addChild(_button);
}

/**
 * Draw the ROM area to the right of the program segments
 */
function drawRoms() {
	if (!showRoms || memoryRom.length === 0) {
		return;
	}
	var _label = new Label({text: ""});

	var _button = new Button({
		label: _label,
		width: memoryWidth,
		height: segmentHeight * (65536 / segmentSize),
		borderWidth: drawBorderWidth,
		borderColor: bank0BorderColor,
		backgroundColor: bank0BackgroundColor,
		rollBackgroundColor: bank0BackgroundColor,
		corner: 0,
		shadowColor: -1,
	}).pos(memoryWidth + programWidth, 0);

	stage.addChild(_button);

	memoryRom.forEach((segment, index) => {

		var _height = ((segmentHeight / segmentSize) * (segment.bottom - segment.top));
		var _text = segment.text;

		if (_height < 14) {
			_text = "";
		}

		var _label = new Label({
			text: _text,
			size: 12,
			color: romBorderColor,
			bold: false,
			lineWidth: memoryWidth,
			labelWidth: memoryWidth * 0.90, // 10% margin
			labelHeight: _height,
			maxSize: 12,
			align: "center",
			valign: "center",
		});

		var _button = new Button({
			label: _label,
			width: memoryWidth,
			height: ((segmentHeight / segmentSize) * (segment.bottom - segment.top)),
			borderWidth: drawBorderWidth,
			borderColor: romBorderColor,
			backgroundColor: romBackgroundColor,
			rollBackgroundColor: romBackgroundColor,
			corner: 0,
			shadowColor: -1,
		}).pos(memoryWidth + programWidth, ((segmentHeight / segmentSize) * segment.top));

		stage.addChild(_button);
	});
}

/**
 * Convert number to 16 bit hex in upper case with a $ at the front
 */
function toHex(value) {
	return ("$" + ("0000" + value.toString(16).toUpperCase()).slice(-4));
}

/**
 * Parses the Assembly Output Memory Ranges. This takes the compiled output from atasm and parses out the MemorySegments that will show when the -noshowmem option is not used.
 * @param {*} data Atasm assembler output
 * @returns [MemorySegment]
 */
function parseMemory(data) {
	// $xxxx-$xxxx NAME
	var patt = /^\s*(\*)?\$([0-9a-f]{4})\-\$([0-9a-f]{4})\s(.*)/;
	var lines = data.split('\n');
	var rangeList = new Array();
	var _memlist = [];

	for (var i = 0; i < lines.length; i++) {

		var match = patt.exec(lines[i]);

		if (!match) {
			if (rangeList.length > 1) break;
			else continue;
		}

		var _virtual = false;

		if (match[1] === "*") {
			_virtual = true;
		}

		_memlist.push(new MemorySegment(parseInt(match[2], 16), parseInt(match[3], 16), match[4], _virtual));

	};

	return _memlist;
}

/**
 * This actually draws out the Memory View in the provider.
 */
function viewRefresh() {
	stage.removeAllChildren();

	updateColors();

	let _size = segmentSize;
	let _top = 0;
	let _bot = _top + _size;

	// Create memory label segments that represent the 64K in segmentSize byte chunks
	var _segments = [];
	for (i = 0; i < (65536 / segmentSize); i++) {
		let _segment = new MemorySegment(_top, _bot, toHex(_top));
		_segments.push(_segment);
		_top += _size;
		_bot += _size;
	}

	drawMemorySegments(_segments);
	drawBankZero();
	drawProgramSegments();
	drawRoms();

	stage.update();
}

/**
 * Creates The View Data And Refresh
 * Usually called when the Developer assembles the source file and an object is created.
 * @param {object} data {.output: atasm text output to be parsed, .size: memory segment size, .showRoms: show the rom memory areas}
 */
function viewCreate(data) {
	memoryData = parseMemory(data.output);
	viewInit(data);
}

/**
 * Initialize The Settings For the View.
 * Usually called when the Settings are updated in VSCode.
 * @param {object} data {.size: memory segment size, .showRoms: show the rom memory areas}
 */
function viewInit(data) {
	segmentSize = data.size;
	showRoms = data.showRoms;

	createCanvas();
	viewRefresh();
}

function createCanvas() {
	var _h = ((65536 / segmentSize) * segmentHeight) + 64;
	var _w = 384; // not sure we need this?

	frame.remakeCanvas(_w, _h);

	stage = frame.stage;
	stageW = frame.width;
	stageH = frame.height;
}

/*
	handles the communication channel
	between our view container and vscode

	currently, the only handler is for setting
	the memory from a build and then creating
	the view from that build
*/
window.addEventListener('message', event => {
	const message = event.data;

	switch (message.type) {
		// refresh view 
		case 'view_refresh': {
			viewRefresh();
			break;
		}

		// set view data
		case 'view_create': {
			viewCreate(message.data);
			break;
		}

		// set view settings
		case 'view_init': {
			viewInit(message.data);
			break;
		}
	}
});

/*
	create the jimjs Frame that our
	controls will be using to draw on the
	canvas for our view

	the size is calculated using a combination
	of defined segment size and defined height
	for each segment

	some global variables are saved here which
	reference the Stage which is used for
	most interactions with the zimjs 
	framework

	https://zimjs.com/docs.html

*/

frame = new Frame("test", 384, 1, "#00000000", "#00000000");

frame.on("ready", () => {

	stage = frame.stage;
	stageW = frame.width;
	stageH = frame.height;

	stage.update();

	// create rom memory segments
	memoryRom.push(new MemorySegment(40960, 49152, "Basic"));
	memoryRom.push(new MemorySegment(49152, 53248, "OS Rom"));
	memoryRom.push(new MemorySegment(53248, 55296, "IO Ports"));
	memoryRom.push(new MemorySegment(55296, 65536, "OS Rom"));

	//const vscode = acquireVsCodeApi();

	// Use the CTRL+mouse wheel to change the size of the segment
	document.body.onwheel = function (e) {

		if (e.ctrlKey) {
			// Reduce segment size
			if (e.deltaY < 0) {
				if (segmentSize === 128) {
					return;
				}
				segmentSize /= 2;
				if (segmentSize < 128) {
					segmentSize = 128;
				}
				createCanvas();
				viewRefresh();
			}

			// Increase segment size
			if (e.deltaY > 0) {

				if (segmentSize === 4096) {
					return;
				}
				segmentSize *= 2;
				if (segmentSize > 4096) {
					segmentSize = 4096;
				}
				createCanvas();
				viewRefresh();
			}
		}
	};
});


function updateColors() {

	classColors = {};

	getColor("memoryForegroundColor");
	getColor("memoryBackgroundColor");
	getColor("memoryBorderColor");
	getColor("memoryRollBackgroundColor");

	memoryForegroundColor = classColors["memoryForegroundColor"];
	memoryBackgroundColor = classColors["memoryBackgroundColor"];
	memoryBorderColor = classColors["memoryBorderColor"];
	memoryRollBackgroundColor = classColors["memoryRollBackgroundColor"];

	getColor("programForegroundColor");
	getColor("programBackgroundColor");
	getColor("programBorderColor");
	getColor("programRollBackgroundColor");

	programForegroundColor = classColors["programForegroundColor"];
	programBackgroundColor = classColors["programBackgroundColor"];
	programBorderColor = classColors["programBorderColor"];
	programRollBackgroundColor = classColors["programRollBackgroundColor"];

	getColor("virtualBackgroundColor");
	virtualBackgroundColor = classColors["virtualBackgroundColor"];

	getColor("bankZeroBackgroundColor");
	getColor("bankZeroBorderColor");

	bank0BackgroundColor = classColors["bankZeroBackgroundColor"];
	bank0BorderColor = classColors["bankZeroBorderColor"];

	getColor("tooltipForegroundColor");
	getColor("tooltipBackgroundColor");
	getColor("tooltipBorderColor");

	tooltipForegroundColor = classColors["tooltipForegroundColor"];
	tooltipBackgroundColor = classColors["tooltipBackgroundColor"];
	tooltipBorderColor = classColors["tooltipBorderColor"];

	getColor("romForegroundColor");
	getColor("romBackgroundColor");

	romBackgroundColor = classColors["romBackgroundColor"];
	romBorderColor = classColors["romForegroundColor"];

}
// "Cache"
var classColors = {};

function getColor(className) {
	// Check for the color
	if (!classColors[className]) {

		// Create an element with the class name and add it to the dom
		$c = $('<div class="' + className + '"></div>').css('display', 'none');
		$(document.body).append($c);

		// Get color from dom and put it in the color cache
		classColors[className] = $c.css('color');

		// Remove the element from the dom again
		$c.remove();
	}

	// Return color
	return classColors[className];
}