/*
 * Game Modes Module for Chess PGN Trainer
 * Implements various training modes
 *
 * Repetition mode logic is fully integrated here.
 * repetition-mode.js is no longer needed and should be deleted.
 */

// Game mode constants
const GAME_MODES = {
    STANDARD:   'standard',
    REPETITION: 'repetition',
    THREE:      'three',
    HASTE:      'haste',
    COUNTDOWN:  'countdown',
    SPEEDRUN:   'speedrun',
    INFINITY:   'infinity'
};

// Game mode configurations
const MODE_CONFIGS = {
    [GAME_MODES.STANDARD]: {
        name: 'Standard Mode',
        description: 'Play puzzles sequentially from a PGN file',
        hasTimer: false,
        hasLives: false,
        hasHints: false,
        hasLevels: false
    },
    [GAME_MODES.REPETITION]: {
        name: 'Repetition Mode',
        description: 'Complete levels perfectly to unlock the next (20 puzzles per level)',
        hasTimer: false,
        hasLives: false,
        hasHints: false,
        hasLevels: true,
        puzzlesPerLevel: 20
    },
    [GAME_MODES.THREE]: {
        name: 'Three Mode',
        description: '3 minutes, 3 lives, 3 hints',
        hasTimer: true,
        hasLives: true,
        hasHints: true,
        hasLevels: false,
        timeLimit: 180,
        lives: 3,
        hints: 3
    },
    [GAME_MODES.HASTE]: {
        name: 'Haste Mode',
        description: 'Start with base time, gain/lose time on correct/incorrect moves',
        hasTimer: true,
        hasLives: false,
        hasHints: false,
        hasLevels: false,
        baseTime: 30,
        timeGain: 5,
        timeLoss: 10
    },
    [GAME_MODES.COUNTDOWN]: {
        name: 'Countdown Mode',
        description: 'Fixed total time to solve as many puzzles as possible',
        hasTimer: true,
        hasLives: false,
        hasHints: false,
        hasLevels: false,
        timeLimit: 600
    },
    [GAME_MODES.SPEEDRUN]: {
        name: 'Speedrun Mode',
        description: 'Complete all puzzles as fast as possible',
        hasTimer: true,
        hasLives: false,
        hasHints: false,
        hasLevels: false,
        isSpeedrun: true
    },
    [GAME_MODES.INFINITY]: {
        name: 'Infinity Mode',
        description: 'Endless play through puzzles',
        hasTimer: false,
        hasLives: false,
        hasHints: false,
        hasLevels: false,
        isInfinite: true
    }
};

// ---------------------------------------------------------------------------
// Runtime state
// ---------------------------------------------------------------------------

let currentGameMode = GAME_MODES.STANDARD;

let modeState = {
    timeRemaining:  0,
    livesRemaining: 0,
    hintsRemaining: 0,
    currentLevel:   1,
    levelProgress:  0,   // puzzles completed without error in the current set
    levelErrors:    0,   // total errors accumulated in the current set
    totalSolved:    0,
    modeTimer:      null,
    isActive:       false
};

// Repetition-mode internal tracking
// (replaces the variables that lived in repetition-mode.js)
let repetitionSetStartIndex = 0;  // value of `increment` when the current set began

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * Initialise the game mode system — call once on page load.
 */
function initializeGameModes() {
    createModeSelector();
    resetModeState();
}

// ---------------------------------------------------------------------------
// Mode selector UI
// ---------------------------------------------------------------------------

function createModeSelector() {
    const modeSelector = document.createElement('div');
    modeSelector.id = 'mode-selector';
    modeSelector.className = 'w3-container w3-margin-bottom';

    const label = document.createElement('label');
    label.textContent = 'Game Mode: ';
    label.className = 'w3-text-indigo';

    const select = document.createElement('select');
    select.id = 'game-mode-select';
    select.className = 'w3-select w3-border w3-round';
    select.style.width = '200px';
    select.style.display = 'inline-block';
    select.style.marginLeft = '8px';

    Object.entries(MODE_CONFIGS).forEach(([key, config]) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = config.name;
        select.appendChild(option);
    });

    select.addEventListener('change', handleModeChange);

    modeSelector.appendChild(label);
    modeSelector.appendChild(select);

    const pgnContainer = document.querySelector('p');
    pgnContainer.parentNode.insertBefore(modeSelector, pgnContainer.nextSibling);

    createModeInfoDisplay();
}

function createModeInfoDisplay() {
    const infoDiv = document.createElement('div');
    infoDiv.id = 'mode-info';
    infoDiv.className = 'w3-container w3-margin-bottom w3-small w3-text-grey';

    const modeSelector = document.getElementById('mode-selector');
    modeSelector.parentNode.insertBefore(infoDiv, modeSelector.nextSibling);

    updateModeInfo();
}

function updateModeInfo() {
    const infoDiv = document.getElementById('mode-info');
    if (infoDiv) {
        infoDiv.textContent = MODE_CONFIGS[currentGameMode].description;
    }
}

// ---------------------------------------------------------------------------
// Mode switching
// ---------------------------------------------------------------------------

function handleModeChange(event) {
    setGameMode(event.target.value);
}

function setGameMode(mode) {
    if (modeState.isActive) {
        if (!confirm('Changing game mode will reset the current session. Continue?')) {
            document.getElementById('game-mode-select').value = currentGameMode;
            return;
        }
        stopModeTimer();
        resetGame();
    }

    currentGameMode = mode;
    resetModeState();
    updateModeInfo();
    updateModeUI();
}

// ---------------------------------------------------------------------------
// State reset
// ---------------------------------------------------------------------------

function resetModeState() {
    const config = MODE_CONFIGS[currentGameMode];

    modeState = {
        timeRemaining:  config.timeLimit || config.baseTime || 0,
        livesRemaining: config.lives || 0,
        hintsRemaining: config.hints || 0,
        currentLevel:   1,
        levelProgress:  0,
        levelErrors:    0,
        totalSolved:    0,
        modeTimer:      null,
        isActive:       false
    };

    // Reset repetition tracking so a new session always starts from the top
    repetitionSetStartIndex = 0;

    updateModeUI();
}

// ---------------------------------------------------------------------------
// UI display helpers
// ---------------------------------------------------------------------------

function updateModeUI() {
    updateTimerDisplay();
    updateLivesDisplay();
    updateHintsDisplay();
    updateLevelDisplay();
    toggleModeElements(MODE_CONFIGS[currentGameMode]);
}

function updateTimerDisplay() {
    const config = MODE_CONFIGS[currentGameMode];
    let timerDiv = document.getElementById('mode-timer');
    if (config.hasTimer) {
        if (!timerDiv) {
            timerDiv = document.createElement('div');
            timerDiv.id = 'mode-timer';
            timerDiv.className = 'w3-container w3-center w3-margin-bottom';
            const label = document.createElement('div');
            label.textContent = 'Time: ';
            label.className = 'w3-text-indigo';
            const display = document.createElement('span');
            display.id = 'timer-display';
            display.className = 'w3-text-red w3-large';
            timerDiv.appendChild(label);
            timerDiv.appendChild(display);
            const landscapeDiv = document.querySelector('.landscapemode .w3-container.w3-center');
            if (landscapeDiv) landscapeDiv.appendChild(timerDiv);
        }
        const display = document.getElementById('timer-display');
        if (display) display.textContent = formatTime(modeState.timeRemaining);
        timerDiv.style.display = 'block';
    } else if (timerDiv) {
        timerDiv.style.display = 'none';
    }
}

function updateLivesDisplay() {
    const config = MODE_CONFIGS[currentGameMode];
    let livesDiv = document.getElementById('mode-lives');
    if (config.hasLives) {
        if (!livesDiv) {
            livesDiv = document.createElement('div');
            livesDiv.id = 'mode-lives';
            livesDiv.className = 'w3-container w3-center w3-margin-bottom';
            const label = document.createElement('div');
            label.textContent = 'Lives: ';
            label.className = 'w3-text-indigo';
            const display = document.createElement('span');
            display.id = 'lives-display';
            display.className = 'w3-text-red w3-large';
            livesDiv.appendChild(label);
            livesDiv.appendChild(display);
            const landscapeDiv = document.querySelector('.landscapemode .w3-container.w3-center');
            if (landscapeDiv) landscapeDiv.appendChild(livesDiv);
        }
        const display = document.getElementById('lives-display');
        if (display) display.textContent = '❤️'.repeat(modeState.livesRemaining);
        livesDiv.style.display = 'block';
    } else if (livesDiv) {
        livesDiv.style.display = 'none';
    }
}

function updateHintsDisplay() {
    const config = MODE_CONFIGS[currentGameMode];
    let hintsDiv = document.getElementById('mode-hints');
    if (config.hasHints) {
        if (!hintsDiv) {
            hintsDiv = document.createElement('div');
            hintsDiv.id = 'mode-hints';
            hintsDiv.className = 'w3-container w3-center w3-margin-bottom';
            const label = document.createElement('div');
            label.textContent = 'Hints: ';
            label.className = 'w3-text-indigo';
            const display = document.createElement('span');
            display.id = 'hints-display';
            display.className = 'w3-text-blue w3-large';
            hintsDiv.appendChild(label);
            hintsDiv.appendChild(display);
            const landscapeDiv = document.querySelector('.landscapemode .w3-container.w3-center');
            if (landscapeDiv) landscapeDiv.appendChild(hintsDiv);
        }
        const display = document.getElementById('hints-display');
        if (display) display.textContent = '💡'.repeat(modeState.hintsRemaining);
        hintsDiv.style.display = 'block';
    } else if (hintsDiv) {
        hintsDiv.style.display = 'none';
    }
}

function updateLevelDisplay() {
    const config = MODE_CONFIGS[currentGameMode];
    let levelDiv = document.getElementById('mode-level');
    if (config.hasLevels) {
        if (!levelDiv) {
            levelDiv = document.createElement('div');
            levelDiv.id = 'mode-level';
            levelDiv.className = 'w3-container w3-center w3-margin-bottom';
            const label = document.createElement('div');
            label.textContent = 'Level: ';
            label.className = 'w3-text-indigo';
            const display = document.createElement('span');
            display.id = 'level-display';
            display.className = 'w3-text-green w3-large';
            levelDiv.appendChild(label);
            levelDiv.appendChild(display);
            const landscapeDiv = document.querySelector('.landscapemode .w3-container.w3-center');
            if (landscapeDiv) landscapeDiv.appendChild(levelDiv);
        }
        const display = document.getElementById('level-display');
        if (display) {
            display.textContent =
                `${modeState.currentLevel} (${modeState.levelProgress}/${config.puzzlesPerLevel})`;
        }
        levelDiv.style.display = 'block';
    } else if (levelDiv) {
        levelDiv.style.display = 'none';
    }
}

function toggleModeElements(config) {
    ['#btn_hint_landscape', '#btn_hint_portrait'].forEach(selector => {
        const button = document.querySelector(selector);
        if (!button) return;
        if (config.hasHints) {
            button.style.display = 'block';
        } else if (currentGameMode !== GAME_MODES.STANDARD) {
            button.style.display = 'none';
        }
    });
}

// ---------------------------------------------------------------------------
// Timer
// ---------------------------------------------------------------------------

function startModeTimer() {
    const config = MODE_CONFIGS[currentGameMode];
    if (!config.hasTimer) return;
    stopModeTimer();
    modeState.isActive = true;
    if (config.isSpeedrun) {
        modeState.timeRemaining = 0;
        modeState.modeTimer = setInterval(() => {
            modeState.timeRemaining++;
            updateTimerDisplay();
        }, 1000);
    } else {
        modeState.modeTimer = setInterval(() => {
            modeState.timeRemaining--;
            updateTimerDisplay();
            if (modeState.timeRemaining <= 0) handleTimeUp();
        }, 1000);
    }
}

function stopModeTimer() {
    if (modeState.modeTimer) {
        clearInterval(modeState.modeTimer);
        modeState.modeTimer = null;
    }
    modeState.isActive = false;
}

function handleTimeUp() {
    stopModeTimer();
    if      (currentGameMode === GAME_MODES.THREE)     endGameSession('Time\'s up! Session ended.');
    else if (currentGameMode === GAME_MODES.HASTE)     endGameSession('Time ran out! Session ended.');
    else if (currentGameMode === GAME_MODES.COUNTDOWN) endGameSession(`Time's up! You solved ${modeState.totalSolved} puzzles.`);
}

// ---------------------------------------------------------------------------
// Move & puzzle event hooks
// Called by chess-pgn-trainer.js at the appropriate moments.
// ---------------------------------------------------------------------------

/**
 * Called after every correct move.
 * Repetition mode ignores individual moves — it only reacts at puzzle completion.
 */
function handleCorrectMove() {
    if (currentGameMode === GAME_MODES.REPETITION) return;

    modeState.totalSolved++;
    if (currentGameMode === GAME_MODES.HASTE) {
        modeState.timeRemaining += MODE_CONFIGS[currentGameMode].timeGain;
        updateTimerDisplay();
    }
}

/**
 * Called after every incorrect move.
 *
 * IMPORTANT: must NOT call loadPuzzle() here.
 * chess-pgn-trainer.js calls game.undo() immediately after this returns,
 * so the board is still mid-move. Loading a new puzzle here would corrupt it.
 *
 * For repetition mode we record the error and let shouldContinueToNextPuzzle()
 * decide what to do once the full puzzle is eventually completed.
 */
function handleIncorrectMove() {
    if (currentGameMode === GAME_MODES.REPETITION) {
        modeState.levelErrors++;
        return;
    }
    if (currentGameMode === GAME_MODES.THREE) {
        modeState.livesRemaining--;
        updateLivesDisplay();
        if (modeState.livesRemaining <= 0) endGameSession('No lives remaining! Session ended.');
    } else if (currentGameMode === GAME_MODES.HASTE) {
        modeState.timeRemaining -= MODE_CONFIGS[currentGameMode].timeLoss;
        if (modeState.timeRemaining < 0) modeState.timeRemaining = 0;
        updateTimerDisplay();
        if (modeState.timeRemaining <= 0) handleTimeUp();
    }
}

/**
 * Called by chess-pgn-trainer.js when the user finishes a complete puzzle.
 *
 * For repetition mode: count the puzzle toward the current set only if it
 * was solved without any errors.
 */
function handlePuzzleComplete() {
    if (currentGameMode !== GAME_MODES.REPETITION) return;

    if (modeState.levelErrors === 0) {
        // Clean solve — count it toward the current set
        modeState.levelProgress++;
    }
    updateLevelDisplay();
    // levelErrors is reset for the next puzzle inside shouldContinueToNextPuzzle()
}

function handleHintUsed() {
    if (MODE_CONFIGS[currentGameMode].hasHints) {
        modeState.hintsRemaining--;
        updateHintsDisplay();
        if (modeState.hintsRemaining <= 0) {
            ['#btn_hint_landscape', '#btn_hint_portrait'].forEach(s => {
                const b = document.querySelector(s);
                if (b) b.disabled = true;
            });
        }
    }
}

// ---------------------------------------------------------------------------
// Puzzle advancement logic
// ---------------------------------------------------------------------------

/**
 * Called by chess-pgn-trainer.js after a puzzle completes to decide whether
 * to move forward.  Always returns true — advancement is always wanted —
 * but for repetition mode this function also adjusts `increment` so that
 * chess-pgn-trainer.js lands on the right puzzle after doing `increment += 1`.
 *
 * Repetition set logic:
 *   - Mid-set (< puzzlesPerLevel done): advance normally.
 *   - Full set complete, all clean:     level up, continue forward.
 *   - Full set complete, had errors:    restart the set by rewinding increment.
 *
 * Why `increment = repetitionSetStartIndex - 1`?
 * chess-pgn-trainer.js does `increment += 1` right after this returns, so
 * setting increment to (start - 1) makes it land exactly on the set start.
 *
 * `increment`, `puzzleset`, and `PuzzleOrder` are globals from
 * chess-pgn-trainer.js, visible here because both files share the page scope.
 */
function shouldContinueToNextPuzzle() {
    if (currentGameMode === GAME_MODES.INFINITY) return true;

    if (currentGameMode === GAME_MODES.REPETITION) {
        const config = MODE_CONFIGS[GAME_MODES.REPETITION];
        const puzzlesCompletedInSet = (increment - repetitionSetStartIndex) + 1;

        // Reset per-puzzle error counter for the upcoming puzzle
        const hadErrors = modeState.levelErrors > 0;
        modeState.levelErrors = 0;

        if (puzzlesCompletedInSet < config.puzzlesPerLevel) {
            // Still working through the set — just advance
            return true;
        }

        // A full set of 20 just finished
        if (!hadErrors && modeState.levelProgress >= config.puzzlesPerLevel) {
            // Perfect set — unlock the next level
            modeState.currentLevel++;
            modeState.levelProgress  = 0;
            repetitionSetStartIndex  = increment + 1;  // next puzzle starts the new set
            updateLevelDisplay();
            setTimeout(() => alert(
                `Level ${modeState.currentLevel - 1} complete! Starting Level ${modeState.currentLevel}.`
            ), 50);
            return true;
        } else {
            // Errors were made — restart the same set
            modeState.levelProgress = 0;
            // Rewind so that after chess-pgn-trainer does increment += 1,
            // it loads the first puzzle of the current set again.
            increment = repetitionSetStartIndex - 1;
            updateLevelDisplay();
            setTimeout(() => alert(
                `Set not clean. Restarting Level ${modeState.currentLevel}.`
            ), 50);
            return true;
        }
    }

    // All other modes: continue while puzzles remain
    return increment + 1 < puzzleset.length;
}

// ---------------------------------------------------------------------------
// Session end
// ---------------------------------------------------------------------------

function endGameSession(message) {
    stopModeTimer();
    setTimeout(() => {
        alert(message);
        if (typeof showresults === 'function') showresults();
    }, 100);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function formatTime(seconds) {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.abs(seconds) % 60;
    const sign = seconds < 0 ? '-' : '';
    return `${sign}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getCurrentGameMode() { return currentGameMode; }
function getModeState()       { return modeState; }
function isHintAvailable()    { return !MODE_CONFIGS[currentGameMode].hasHints || modeState.hintsRemaining > 0; }

// ---------------------------------------------------------------------------
// Module export (Node / test environments only)
// ---------------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GAME_MODES, MODE_CONFIGS,
        initializeGameModes, setGameMode,
        getCurrentGameMode, getModeState,
        startModeTimer, stopModeTimer,
        handleCorrectMove, handleIncorrectMove, handlePuzzleComplete, handleHintUsed,
        isHintAvailable, shouldContinueToNextPuzzle,
        resetModeState, updateModeUI
    };
}
