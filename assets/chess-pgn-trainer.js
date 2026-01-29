/*
* Chess-PGN-Trainer
*/

/* eslint linebreak-style: ["error", "unix"] */
/* eslint indent: ["error", "tab"] */
/* eslint semi-style: ["error", "last"] */
/* eslint semi: ["error"] */

/* eslint no-undef: "error"*/
/* global Chess, Chessboard, PgnParser, FileReader */
/* global $, document, localStorage, alert, navigator, window */
/* global w3_close, showresults */

/* eslint no-unused-vars: ["error", { "vars": "all", "args": "none"}] */


/*

Features for this version:
* Fixed regression bug with move indication when using both flipped and opposite side functions.

*/



// -----------------------
// Define global variables
// -----------------------

// Board & Overall configuration-related variables
const version = '1.8.2';
let board;
let blankBoard;
let pieceThemePath;
let game;
let config;
let PieceList;
let AnalysisLink = false;

// Game & Performance variables
let moveCfg;
let moveHistory;
let puzzleset;
let errorcount;
let error;
let ElapsedTimehhmmss;
let AvgTimehhmmss;
let ErrorRate;
let setcomplete;
let stats;
let puzzlecomplete = false;
let pauseflag = false;
let increment = 0;
let PuzzleOrder = [];

// Promotion variables
let promoteTo;
let promotionDialog;
let sourceSquare = null;

// Time-related variables
let PauseStartDateTime;
let PauseendDateTime;
let startDateTime = new Date();
let pauseDateTimeTotal = 0;



// -------------
// Initial Setup
// -------------

// Version number of the app
$('#versionnumber').text(`version ${version}`);

// Collection of checkboxes used in the app
let checkboxlist = ['#playbothsides', '#playoppositeside', '#randomizeSet', '#flipped', '#analysisboard'];

// Collection of text elements
let messagelist = ['#messagecomplete', '#puzzlename_landscape', '#puzzlename_portrait', '#errors', '#errorRate', '#elapsedTime', '#avgTime'];

// Assign default configuration of the board
// Assign default theme for the pieces for both the board and the promotion popup window

//pieceThemePath = 'https://github.com/lichess-org/lila/raw/refs/heads/master/public/piece/alpha/{piece}.svg'
pieceThemePath = 'img/chesspieces/staunty/{piece}.svg';

promotionDialog = $('#promotion-dialog');

// Initial Board Configuration
config = {
        draggable: true,
        pieceTheme: pieceThemePath,
        onDragStart: dragStart,
        onDrop: dropPiece,
        onSnapEnd: snapEnd,
        position: 'start',
};



// -----------------------
// Local stoarge Functions
// -----------------------

/**
 * Save current game progress to resume later
 */
function saveCurrentGameProgress() {
        if (!puzzleset || puzzleset.length === 0 || setcomplete) {
                return;
        }

        const gameState = {
                increment: increment,
                PuzzleOrder: PuzzleOrder,
                puzzleset: puzzleset,
                errorcount: errorcount,
                pauseDateTimeTotal: pauseDateTimeTotal,
                startDateTime: startDateTime.getTime(),
                lastSelectedPgnFile: $('#openPGN').val(),
                timestamp: new Date().getTime()
        };

        saveGameState(gameState);
}

/**
 * Resume game from saved state
 */
function resumeSavedGame() {
        const savedState = loadGameState();
        if (!savedState) return false;

        // Basic validation of saved state
        if (!savedState.puzzleset || savedState.puzzleset.length === 0) return false;

        // Restore state variables
        puzzleset = savedState.puzzleset;
        PuzzleOrder = savedState.PuzzleOrder;
        increment = savedState.increment;
        errorcount = savedState.errorcount;
        pauseDateTimeTotal = savedState.pauseDateTimeTotal;
        startDateTime = new Date(savedState.startDateTime);

        if (savedState.lastSelectedPgnFile) {
                $('#openPGN').val(savedState.lastSelectedPgnFile);
        }

        // Setup UI for the resumed game
        $('#puzzleNumbertotal_landscape').text(puzzleset.length);
        $('#puzzleNumbertotal_portrait').text(puzzleset.length);

        // Load the puzzle we were on
        loadPuzzle(puzzleset[PuzzleOrder[increment]]);

        // UI adjustments - Match startTest UI state
        setDisplayAndDisabled(
                ['#btn_starttest_landscape', '#btn_starttest_portrait',
                        '#btn_restart_landscape', '#btn_restart_portrait', '#btn_showresults'], 'none');
        setDisplayAndDisabled(
                ['#btn_pause_landscape', '#btn_pause_portrait',
                        '#btn_hint_landscape', '#btn_hint_portrait'], 'block', false);
        setCheckboxSelectability(false);

        return true;
}

window.addEventListener('beforeunload', () => {
        saveCurrentGameProgress();
});

document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
                saveCurrentGameProgress();
        }
});

/**
 * Save a key/value pair to local storage
 * @param {string} key - The name of the key 
 * @param {string} value - The value of the key
 */
function saveItem(key, value) { localStorage.setItem(key, value); }

/**
 * Read the value of a specific key from local storage
 * @param {String} key - The key name for which the value is to be read
 * @returns {string}
 */
function readItem(key) {
        let value = localStorage.getItem(key);
        return value;
}

/**
 * Deletes the specified key from local storage
 * @param {string} key - The key to delete
 */
function deleteItem(key) { localStorage.removeItem(key); } // eslint-disable-line no-unused-vars

/**
 * Clear all items in local storage
 */
function clearItems() { localStorage.clear(); }



// -----------------------------------
// Functions for related to appearance
// -----------------------------------

/**
 * Populate the piece selection drop down with the list of pieces
 */
function addPieceSetNames() {

        // Clear any pre-existing values
        $('#piece-select').find('option').remove().end();

        // Populate the dropdown with the available options
        PieceList.forEach(
                (theme) => {
                        var newOption = $('<option>');
                        newOption.attr('value', theme.DirectoryName).text(theme.Name);
                        $('#piece-select').append(newOption);
                }
        );

        // Set the drop down to the saved value
        document.getElementById("piece-select").selectedIndex = readItem('pieceIndex');

}

/**
 * Sets the piece theme.  Warming: This will reset the board. Don't use while doing a set.
 */
function changePieces() {

        // TODO: Revisit this to see if I can use the text value instead of the index...
        saveItem('pieceIndex', document.getElementById("piece-select").selectedIndex);

        // Load the selected piece theme into a temp object
        var pieceObject;
        pieceObject = PieceList.find(x => x.DirectoryName === document.getElementById('piece-select').value);

        // Build the path to the piece theme using the object properties
        pieceThemePath = 'img/chesspieces/' + pieceObject.DirectoryName + '/{piece}.' + pieceObject.Type;

        config = {
                draggable: true,
                pieceTheme: pieceThemePath,
                onDragStart: dragStart,
                onDrop: dropPiece,
                onSnapEnd: snapEnd,
                position: 'start',
        };

        // Update the board with the new pieces
        Chessboard('myBoard', config);

        // Set the colors after the piece change
        changecolor();

        // Reset the game
        resetGame();
}

/**
 * Applies the specified color values (RGB) to the board
 * 
 * @param {string} light - The RGB color value for the light squares (such as h1)
 * @param {string} dark - The RGB color value for the dark squares (such as a1) 
 */
function setBoardColor(light, dark) {
        $(".white-1e1d7").css({ "backgroundColor": '#' + light, "color": '#' + dark });
        $(".black-3c85d").css({ "backgroundColor": '#' + dark, "color": '#' + light });
}

/**
 * Sets the values for the board color based on selections via the color picker or manual entry
 * and then applies the values to the board
 */
function changecolor() {

        // Read the values from the color picker inputs
        var light = document.getElementById('Light-Color').value.replace("#", "").trim();
        var dark = document.getElementById('Dark-Color').value.replace("#", "").trim();

        // Update the board colors based on the values
        setBoardColor(light, dark);

        // Save updated values
        saveItem('light', light);
        saveItem('dark', dark);

}

/**
 * Toggles the application between dark and light mode.  Saves current setting to file
 */
function toggleDarkMode() {

        document.body.classList.toggle("darkmode");

        var elmWitchChange = document.getElementsByClassName('light-mode');
        var i;

        for (i = 0; i < elmWitchChange.length; i++) {
                elmWitchChange[i].classList.toggle('darkmode');
        }

        elmWitchChange = document.getElementsByClassName('light-mode-control');
        for (i = 0; i < elmWitchChange.length; i++) {
                elmWitchChange[i].classList.toggle('darkmode-control');
        }

        // Check current status of the setting and save 
        if ($('#title_header').hasClass('darkmode')) {
                saveItem('darkmode', '1');
                // change logo
                $("#img_logo").attr("src", "./img/github-mark-white.svg");
                $('#chk_darkmode').prop('checked', true);

        } else {
                saveItem('darkmode', '0');
                // change logo
                $("#img_logo").attr("src", "./img/github-mark.svg");
                $('#chk_darkmode').prop('checked', false);
        }

}

/**
 * Resize both boards to available space
 */
function resizeBoards() { // eslint-disable-line no-unused-vars
        board.resize();
        blankBoard.resize();
        changecolor();
}

/**
 * Update the on-screen board with the current status of the game
 *
 * @param {boolean} animate - Set to True to animate the pieces while setting up the position.  
 *                                                        Setting to false sets the pieces instantly.
 */
function updateBoard(animate) {
        board.position(game.fen(), animate);
        
        // Highlight last move for visual clarity
        const history = game.history({ verbose: true });
        if (history.length > 0) {
                const lastMove = history[history.length - 1];
                $('#myBoard .square-55d63').removeClass('last-move');
                $('#myBoard .square-' + lastMove.from).addClass('last-move');
                $('#myBoard .square-' + lastMove.to).addClass('last-move');
        }
}



// ------------------------------------
// Settings and configuration functions
// ------------------------------------

/**
 * Handle user choice for resuming game
 * @param {boolean} resume - True to resume, false to start new
 */
function handleResumeChoice(resume) {
        document.getElementById('resume-modal').style.display = 'none';
        if (resume) {
                if (resumeSavedGame()) {
                        console.log('Game resumed from saved state');
                }
        } else {
                clearSavedGameState();
                resetGame();
        }
}

/**
 * Initializes the application upon load
 */
function initalize() {

        loadSettings();
        addPieceSetNames();
        changePieces();
        resetGame();

        // Try to resume a saved game
        setTimeout(() => {
                if (loadGameState()) {
                        document.getElementById('resume-modal').style.display = 'block';
                }
        }, 500);

        // Initialize game modes system
        if (typeof initializeGameModes === 'function') {
                initializeGameModes();
        }

        // Add click-to-move support - Moved to a global delegation to survive board resets
        $(document).off('mousedown.clickToMove touchstart.clickToMove').on('mousedown.clickToMove touchstart.clickToMove', '#myBoard [class*="square-"]', function(e) {
                const square = $(this).attr('data-square') || $(this).closest('.square-55d63').attr('data-square');
                if (square) {
                        onSquareClick(square);
                }
        });
}

/**
 * Sets default values for board color and piece theme
 */
function resetSettings() { // eslint-disable-line no-unused-vars

        clearItems();
        initalize();

        // Check to see if dark mode is active currently which is not the default and change back to light mode if that is the case
        if ($('#title_header').hasClass('darkmode') && readItem('darkmode') == "0") { toggleDarkMode(); }

}

/**
 * Load the settings for the application.  Sets defaults if values are not found
 */
function loadSettings() {

        // Set defaults if running for the first time

        // Default keys and values
        var defaults = { light: 'DEE3E6', dark: '769457', pieceIndex: '0', darkmode: '0', copy2clipboard: '1', csvheaders: '1' };

        // Load defaults if any keys are missing
        for (const [key, value] of Object.entries(defaults)) {
                if (readItem(key) == null || readItem(key) == "") { saveItem(key, value); }
        }

        // Load color values into the settings modal UI
        document.getElementById('Light-Color').value = readItem('light');
        document.getElementById('Dark-Color').value = readItem('dark');

        // Toggle dark mode if previously set
        if (readItem('darkmode') == "1") { toggleDarkMode(); }

        // Auto-copy to clipboard setting
        if (readItem('copy2clipboard') == "1") { $("#chk_clipboard").prop("checked", true); }

        // CSV Headers setting
        if (readItem('csvheaders') == "1") { $("#chk_csvheaders").prop("checked", true); }

}

/**
 * Show the settings modal
 */
function showSettings() { // eslint-disable-line no-unused-vars
        document.getElementById('settings-dialog').style.display = 'block';
}

/**
 * Since it is non-sensical to have both selected, only allow either "Play both sides" or "Play opposite side" 
 * to be checked but not both.
 */
function confirmOnlyOneOption() {

        // Clear both options if somehow both options get checked (ex: both options enabled via PGN tag)
        if ($('#playoppositeside').is(':checked') && $('#playbothsides').is(':checked')) {
                $('#playbothsides').prop('checked', false);
                $('#playoppositeside').prop('checked', false);
                $('#playbothsides').prop('disabled', false);
                $('#playoppositeside').prop('disabled', false);
        }

        // Enable both options as long as neither option is already checked
        if (!$('#playoppositeside').is(':checked') && !$('#playbothsides').is(':checked')) {
                $('#playbothsides').prop('disabled', false);
                $('#playoppositeside').prop('disabled', false);
        }

        // Disable "Play opposite side" since "Play both sides" is checked
        if ($('#playbothsides').is(':checked')) {
                $('#playoppositeside').prop('disabled', true);
        }

        // Disable "Play both sides" since "Play opposite side" is checked
        if ($('#playoppositeside').is(':checked')) {
                $('#playbothsides').prop('disabled', true);
        }

}

/**
 * Either turn on or off the ability to select options (ie: don't allow changes while in a game)
 *
 * @param {boolean} state - Set to true to enable the checkboxes. Set to false to disable the checkboxes.
 */
function setCheckboxSelectability(state) {

        for (var checkboxelement of checkboxlist) {
                if (state) {
                        if ($(checkboxelement).prop('disabled')) {
                                $(checkboxelement).removeAttr('disabled');
                                confirmOnlyOneOption();
                        }
                } else {
                        $(checkboxelement).attr('disabled', true);
                }
        }
}

/**
 * Set the CSS display and disabled properties of a given element
 * 
 * @param {array} listofElements - Array of controls to set in JQuery naming format (ie: prefaced with #)
 * @param {boolean} visible - Set to true to make the control visible. Set to false to hide the control.
 * @param {boolean} disabled - Set to true to disable the control. Set to false to enable the control.
 */
function setDisplayAndDisabled(listofElements, visible, disabled) {

        for (var elementName of listofElements) {
                // Set the visibility of the element
                if (visible !== undefined) {
                        $(elementName).css('display', visible);
                }

                // Set the status of the disabled property of the element
                if (disabled !== undefined) {
                        $(elementName).prop('disabled', disabled);
                }
        }

}

/**
 * Toggle the local file value for a specific setting based on checkbox status
 *
 * @param {string} elementname - The name of the checkbox (pre-pend with a #)
 * @param {string} dataname - The key name of the element in local storage
 */
function toggleSetting(elementname, dataname) { // eslint-disable-line no-unused-vars

        // Default value
        saveItem(dataname, '0');

        // Set to "1" (aka "True" or "On") if checked
        if ($(elementname).is(':checked')) { saveItem(dataname, '1'); }

}



// ------------------
// Gameplay functions
// ------------------

function handleCorrectMove() {
        // Add a subtle green flash to the board
        $('#myBoard').css('box-shadow', '0 0 20px rgba(0, 255, 0, 0.5)');
        setTimeout(() => {
                $('#myBoard').css('box-shadow', 'none');
        }, 300);
}

function handleIncorrectMove() {
        // Add a subtle red flash to the board
        $('#myBoard').css('box-shadow', '0 0 20px rgba(255, 0, 0, 0.5)');
        setTimeout(() => {
                $('#myBoard').css('box-shadow', 'none');
        }, 300);
}

/**
 * Handle square clicks for click-to-move functionality
 * @param {string} square - The square clicked (e.g., 'e2')
 */
function onSquareClick(square) {
        console.log('Square clicked:', square);
        // If the game is paused, don't allow moves
        if (pauseflag) return;

        // Clear selection highlight only
        $('#myBoard .square-55d63').css('box-shadow', '');

        // If no source square is selected, select it if it has a piece of the correct color
        if (sourceSquare === null) {
                const piece = game.get(square);
                if (piece && piece.color === game.turn()) {
                        sourceSquare = square;
                        // Highlight selected square
                        $('#myBoard .square-' + square).css('box-shadow', 'inset 0 0 3px 3px yellow');
                        console.log('Source square selected:', sourceSquare);
                }
        } else {
                console.log('Attempting move from', sourceSquare, 'to', square);
                
                // If clicking the same square, deselect it
                if (sourceSquare === square) {
                        sourceSquare = null;
                        return;
                }

                // Attempt to move from sourceSquare to square
                const move = {
                        from: sourceSquare,
                        to: square,
                        promotion: 'q' // Default to queen for simplicity
                };

                // Try making the move
                const result = makeMove(game, move);

                if (result !== 'snapback') {
                        // Success! Handle the move as if it were a drop
                        updateBoard(true);
                        
                        // Small delay to let the board update before checking next move
                        setTimeout(function() {
                                checkAndPlayNext();
                        }, 100);
                        
                        console.log('Move successful');
                        sourceSquare = null;
                } else {
                        console.log('Move failed (snapback)');
                        // If clicking another piece of the same color, treat it as a new selection
                        const piece = game.get(square);
                        if (piece && piece.color === game.turn()) {
                                sourceSquare = square;
                                $('#myBoard .square-' + square).css('box-shadow', 'inset 0 0 3px 3px yellow');
                        } else {
                                // Clicked an illegal destination square - reset selection
                                sourceSquare = null;
                        }
                }
        }
}

/**
 * Compare latest played move to the move in the same position as the PGN
 *
 * @returns {string}
 */
function handleCorrectMove() {
        // Visual feedback for correct move
        $('#myBoard').css('box-shadow', '0 0 20px rgba(0, 255, 0, 0.5)');
        setTimeout(() => $('#myBoard').css('box-shadow', 'none'), 300);
}

function handleIncorrectMove() {
        // Visual feedback for incorrect move
        $('#myBoard').css('box-shadow', '0 0 20px rgba(255, 0, 0, 0.5)');
        setTimeout(() => $('#myBoard').css('box-shadow', 'none'), 300);
}

function checkAndPlayNext() {
        // Save progress after every move
        saveCurrentGameProgress();

        // Need to go this way since .moveNumber isn't working...
        if (game.history()[game.history().length - 1] === moveHistory[game.history().length - 1]) { // correct move

                handleCorrectMove();

                // play next move if the "Play both sides" box is unchecked
                if (!$('#playbothsides').is(':checked')) {
                        // Play the opponent's next move from the PGN
                        const move = moveHistory[game.history().length];
                        game.move(move);
                        updateBoard(true);
                }

                // Check to see if we reached the end of the puzzle
                if (game.history().length === moveHistory.length) {
                        puzzlecomplete = true;
                        playCorrectSound();
                        nextPuzzle();
                }

        } else { // incorrect move

                handleIncorrectMove();

                errorcount++;
                $('#errors').text(errorcount);
                error = true;
                playIncorrectSound();
                game.undo();
                updateBoard(true);
        }
}

/**
 * Plays the correct move sound
 */
function playCorrectSound() {
        // Placeholder for sound
}

/**
 * Plays the incorrect move sound
 */
function playIncorrectSound() {
        // Placeholder for sound
}

/**
 * Loads a PGN file and populates the puzzleset
 */
function loadPGNFile() {
        const pgnFile = $('#openPGN').val();
        if (!pgnFile) return;

        fetch(pgnFile)
                .then(response => response.text())
                .then(data => {
                        const puzzles = parsePGN(data);
                        if (puzzles && puzzles.length > 0) {
                                puzzleset = puzzles;
                                PuzzleOrder = Array.from({length: puzzleset.length}, (_, i) => i);
                                if ($('#randomizeSet').is(':checked')) {
                                        PuzzleOrder = shuffle(PuzzleOrder);
                                }
                                increment = 0;
                                $('#puzzleNumbertotal_landscape').text(puzzleset.length);
                                $('#puzzleNumbertotal_portrait').text(puzzleset.length);
                                $('#puzzleNumber_landscape').text(1);
                                $('#puzzleNumber_portrait').text(1);
                                
                                // Enable Start buttons
                                setDisplayAndDisabled(['#btn_starttest_landscape', '#btn_starttest_portrait'], 'block', false);
                                
                                loadPuzzle(puzzleset[PuzzleOrder[increment]]);
                        }
                })
                .catch(error => {
                        console.error('Error loading PGN file:', error);
                        alert('Error loading PGN file. Please check the console for details.');
                });
}

/**
 * Parses PGN data into an array of puzzle objects
 */
function parsePGN(data) {
        // Simple PGN parser implementation
        const games = data.split(/\n\n(?=\[Event)/g);
        return games.map((game, index) => {
                const tags = {};
                const tagRegex = /\[(\w+)\s+"([^"]+)"\]/g;
                let match;
                while ((match = tagRegex.exec(game)) !== null) {
                        tags[match[1]] = match[2];
                }
                
                const movesMatch = game.split(/\n\n/)[1];
                const pgn = movesMatch ? movesMatch.replace(/\{.*?\}/g, '').trim() : '';
                
                return {
                        name: tags.Event || tags.White + ' vs ' + tags.Black || 'Puzzle ' + (index + 1),
                        pgn: game,
                        fen: tags.FEN || null,
                        orientation: (tags.FEN && tags.FEN.split(' ')[1] === 'b') ? 'black' : 'white'
                };
        });
}

/**
 * Shuffles an array
 */
function shuffle(array) {
        let currentIndex = array.length, randomIndex;
        while (currentIndex !== 0) {
                randomIndex = Math.floor(Math.random() * currentIndex);
                currentIndex--;
                [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
}

/**
 * Starts the test/training session
 */
function startTest() {
        if (!puzzleset || puzzleset.length === 0) return;
        
        setcomplete = false;
        pauseflag = false;
        startDateTime = new Date();
        pauseDateTimeTotal = 0;
        
        // UI adjustments
        setDisplayAndDisabled(
                ['#btn_starttest_landscape', '#btn_starttest_portrait',
                        '#btn_restart_landscape', '#btn_restart_portrait', '#btn_showresults'], 'none');
        setDisplayAndDisabled(
                ['#btn_pause_landscape', '#btn_pause_portrait',
                        '#btn_hint_landscape', '#btn_hint_portrait'], 'block', false);
        setCheckboxSelectability(false);
        
        // Start mode timer if applicable
        if (typeof startModeTimer === 'function') {
                startModeTimer();
        }
}

// Bind Start buttons
$(document).on('click', '#btn_starttest_landscape, #btn_starttest_portrait', function() {
        startTest();
});

// Bind Hint buttons
$(document).on('click', '#btn_hint_landscape, #btn_hint_portrait', function() {
        if (typeof handleHintUsed === 'function') {
                handleHintUsed();
        }
});

/**
 * Progresses the application to the next puzzle in the set
 */
function nextPuzzle() {

        if (increment < puzzleset.length - 1) {
                increment++;
                $('#puzzleNumber_landscape').text(increment + 1);
                $('#puzzleNumber_portrait').text(increment + 1);
                loadPuzzle(puzzleset[PuzzleOrder[increment]]);
        } else {
                setcomplete = true;
                showresults();
        }
}

/**
 * Loads a puzzle into the application
 *
 * @param {object} puzzle - The puzzle object to load
 */
function loadPuzzle(puzzle) {

        game = new Chess();
        game.load_pgn(puzzle.pgn);
        moveHistory = game.history();
        game.reset();

        // Set the board orientation
        var orientation = 'white';
        if (puzzle.orientation) {
                orientation = puzzle.orientation;
        } else if (game.turn() === 'b') {
                orientation = 'black';
        }

        if ($('#flipped').is(':checked')) {
                orientation = (orientation === 'white') ? 'black' : 'white';
        }

        board.orientation(orientation);

        // Load the starting position
        if (puzzle.fen) {
                game.load(puzzle.fen);
        }

        updateBoard(false);
        puzzlecomplete = false;
        error = false;

        // Update puzzle name
        var puzName = puzzle.name || 'Puzzle ' + (increment + 1);
        $('#puzzlename_landscape').text(puzName);
        $('#puzzlename_portrait').text(puzName);

        // If it's not the user's turn, play the first move
        if (!$('#playoppositeside').is(':checked') && game.turn() !== orientation.charAt(0)) {
                const move = moveHistory[0];
                game.move(move);
                updateBoard(true);
        }
}

/**
 * Resets the current game state
 */
function resetGame() {

        game = new Chess();
        board = Chessboard('myBoard', config);
        blankBoard = Chessboard('blankBoard', config);
        
        puzzleset = [];
        increment = 0;
        PuzzleOrder = [];
        errorcount = 0;
        setcomplete = false;
        puzzlecomplete = false;
        pauseflag = false;

        $('#errors').text('0');
        $('#errorRate').text('0%');
        $('#elapsedTime').text('00:00:00');
        $('#avgTime').text('00:00:00');
        
        $('#puzzleNumber_landscape').text('0');
        $('#puzzleNumber_portrait').text('0');
        $('#puzzleNumbertotal_landscape').text('0');
        $('#puzzleNumbertotal_portrait').text('0');

        // Reset UI
        setDisplayAndDisabled(
                ['#btn_starttest_landscape', '#btn_starttest_portrait',
                        '#btn_restart_landscape', '#btn_restart_portrait'], 'block', false);
        setDisplayAndDisabled(
                ['#btn_pause_landscape', '#btn_pause_portrait',
                        '#btn_hint_landscape', '#btn_hint_portrait', '#btn_showresults'], 'none');
        setCheckboxSelectability(true);
}

/**
 * Makes a move in the game
 *
 * @param {object} gameObj - The chess.js game object
 * @param {object} move - The move object {from: 'e2', to: 'e4', promotion: 'q'}
 * @returns {object|string} - The move object if successful, 'snapback' otherwise
 */
function makeMove(gameObj, move) {
        const result = gameObj.move(move);
        if (result === null) return 'snapback';
        return result;
}

/**
 * Handles the start of a piece drag
 */
function dragStart(source, piece, position, orientation) {
        if (game.game_over() || pauseflag || setcomplete) return false;

        // Only pick up pieces for the side to move
        if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
                (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
                return false;
        }
}

/**
 * Handles the dropping of a piece on a square
 */
function dropPiece(source, target) {
        const move = {
                from: source,
                to: target,
                promotion: 'q' // Default to queen
        };

        const result = makeMove(game, move);

        if (result === 'snapback') return 'snapback';

        updateBoard(true);
        
        setTimeout(function() {
                checkAndPlayNext();
        }, 100);
}

/**
 * Handles the end of a piece snap animation
 */
function snapEnd() {
        updateBoard(false);
}

// Initialize the app
$(document).ready(function() {
        initalize();
});
