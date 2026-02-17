/*
 * Repetition Mode Implementation for Chess PGN Trainer
 */

let currentSetStartIndex = 0;
let currentPuzzleIndex = 0;
let puzzleSetSize = 20;
let progress = 0;

/**
 * Initialize repetition mode progress from storage
 */
function initRepetitionProgress() {
    currentSetStartIndex = loadProgress();
    currentPuzzleIndex = 0;
    progress = 0;
}

/**
 * Start repetition mode training
 */
function startRepetitionMode() {
    initRepetitionProgress();
    // In this app's architecture, loadPGNFile is usually triggered by UI
    // but we can ensure the state is ready
    if (typeof resetModeState === 'function') {
        resetModeState();
    }
}

/**
 * Handle correct puzzle completion in repetition mode
 */
function onPuzzleCompleteInRepetition() {
    progress++;
    
    // Update the game-modes system state
    if (typeof modeState !== 'undefined') {
        modeState.levelProgress = progress % puzzleSetSize;
        modeState.totalSolved++;
        updateLevelDisplay();
    }

    if (progress % puzzleSetSize === 0) {
        currentSetStartIndex += puzzleSetSize;
        saveProgress(currentSetStartIndex);
        alert("Set complete! Moving to next set.");
        // Reset progress for next set
        progress = 0;
        currentPuzzleIndex = 0;
        
        if (typeof modeState !== 'undefined') {
            modeState.currentLevel++;
            modeState.levelProgress = 0;
            updateLevelDisplay();
        }
    } else {
        currentPuzzleIndex++;
        // Use the main app's loadPuzzle if available
        if (typeof puzzleset !== 'undefined' && puzzleset.length > currentPuzzleIndex) {
            loadPuzzle(puzzleset[currentPuzzleIndex]);
        }
    }
}

// Hook into the existing game-modes.js logic if needed
if (typeof GAME_MODES !== 'undefined') {
    // Override the generic handlers in game-modes.js for repetition mode
    const originalHandleCorrectMove = handleCorrectMove;
    handleCorrectMove = function() {
        if (getCurrentGameMode() === GAME_MODES.REPETITION) {
            // Do nothing on individual moves in repetition mode
            // We wait for puzzle completion signal from the trainer
        } else {
            originalHandleCorrectMove();
        }
    };
    
    // Global handler for puzzle completion
    window.handlePuzzleComplete = function() {
        if (getCurrentGameMode() === GAME_MODES.REPETITION) {
            onPuzzleCompleteInRepetition();
        }
    };

    const originalHandleIncorrectMove = handleIncorrectMove;
    window.handleIncorrectMove = function() {
        if (getCurrentGameMode() === GAME_MODES.REPETITION) {
            onMistakeInRepetition();
        } else {
            originalHandleIncorrectMove();
        }
    };
}

/**
 * Handle mistake in repetition mode
 */
function onMistakeInRepetition() {
    alert("Mistake! Restarting current set.");
    // We don't necessarily want to clear ALL progress (which might be across many sets)
    // but rather restart the current set.
    progress = 0;
    currentPuzzleIndex = 0;
    
    if (typeof modeState !== 'undefined') {
        modeState.levelProgress = 0;
        modeState.levelErrors++;
        updateLevelDisplay();
    }
    
    // Load the first puzzle of the current set again
    if (typeof puzzleset !== 'undefined') {
        loadPuzzle(puzzleset[0]);
    }
}
