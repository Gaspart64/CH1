/*
 * Game Modes Module for Chess PGN Trainer
 * Implements various training modes inspired by BlitzTactics
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
        hasTimer:  false,
        hasLives:  false,
        hasHints:  false,
        hasLevels: false,
        hasCombo:  false
    },
    [GAME_MODES.REPETITION]: {
        name: 'Repetition Mode',
        description: 'Complete 20 puzzles with no errors to advance to the next level. Any mistake restarts the level.',
        hasTimer:        false,
        hasLives:        false,
        hasHints:        false,
        hasLevels:       true,
        hasCombo:        false,
        puzzlesPerLevel: 20
    },
    [GAME_MODES.THREE]: {
        name: 'Three Mode',
        description: '3 minutes, 3 lives, 3 hints — solve as many puzzles as you can.',
        hasTimer:  true,
        hasLives:  true,
        hasHints:  true,
        hasLevels: false,
        hasCombo:  false,
        timeLimit: 180,
        lives:     3,
        hints:     3
    },
    [GAME_MODES.HASTE]: {
        // Confirmed from blitztactics.com community discussions (Lichess forum,
        // including IM opperwezen and others):
        //   - Start with 3 minutes (180s)
        //   - Each mistake costs 30 seconds and resets the combo
        //   - Time is earned through combos (streaks of correct puzzles),
        //     not on every individual correct move
        //   - The longer the streak the bigger the bonus
        //
        // comboThresholds: award `gain` seconds when comboCount reaches `at`.
        // Exact blitztactics thresholds are not publicly documented; these
        // values are estimated from community descriptions.
        name: 'Haste Mode',
        description: 'Start with 3 minutes. Build combos to gain time. Each mistake costs 30 seconds.',
        hasTimer:  true,
        hasLives:  false,
        hasHints:  false,
        hasLevels: false,
        hasCombo:  true,
        baseTime:  180,
        timeLoss:  30,
        comboThresholds: [
            { at: 2,  gain: 3  },
            { at: 5,  gain: 5  },
            { at: 10, gain: 8  },
            { at: 20, gain: 12 },
            { at: 30, gain: 15 }
        ]
    },
    [GAME_MODES.COUNTDOWN]: {
        name: 'Countdown Mode',
        description: 'Solve as many puzzles as possible in 10 minutes.',
        hasTimer:  true,
        hasLives:  false,
        hasHints:  false,
        hasLevels: false,
        hasCombo:  false,
        timeLimit: 600
    },
    [GAME_MODES.SPEEDRUN]: {
        name: 'Speedrun Mode',
        description: 'Complete all puzzles as fast as possible.',
        hasTimer:   true,
        hasLives:   false,
        hasHints:   false,
        hasLevels:  false,
        hasCombo:   false,
        isSpeedrun: true
    },
    [GAME_MODES.INFINITY]: {
        name: 'Infinity Mode',
        description: 'Endless play \u2014 puzzles loop forever.',
        hasTimer:   false,
        hasLives:   false,
        hasHints:   false,
        hasLevels:  false,
        hasCombo:   false,
        isInfinite: true
    }
};

// Current game mode state
let currentGameMode = GAME_MODES.STANDARD;
let modeState = {
    timeRemaining:  0,
    livesRemaining: 0,
    hintsRemaining: 0,
    currentLevel:   1,
    levelProgress:  0,
    levelErrors:    0,
    totalSolved:    0,
    comboCount:     0,   // Haste: current correct-puzzle streak
    modeTimer:      null,
    isActive:       false
};

/**
 * Initialize game mode system
 */
function initializeGameModes() {
    createModeSelector();
    resetModeState();
}

/**
 * Create the mode selector UI
 */
function createModeSelector() {
    if (document.getElementById('mode-selector')) return;

    const modeSelector = document.createElement('div');
    modeSelector.id = 'mode-selector';
    modeSelector.className = 'w3-container w3-margin-bottom';
    modeSelector.style.paddingTop = '8px';

    const label = document.createElement('label');
    label.textContent = 'Game Mode: ';
    label.className = 'w3-text-indigo';
    label.style.fontWeight = 'bold';

    const select = document.createElement('select');
    select.id = 'game-mode-select';
    select.className = 'w3-select w3-border w3-round';
    select.style.cssText = 'width:200px;display:inline-block;margin-left:8px;font-size:13px;';

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
    if (pgnContainer) {
        pgnContainer.parentNode.insertBefore(modeSelector, pgnContainer.nextSibling);
    }

    createModeInfoDisplay();
}

/**
 * Create mode information display
 */
function createModeInfoDisplay() {
    if (document.getElementById('mode-info')) return;

    const infoDiv = document.createElement('div');
    infoDiv.id = 'mode-info';
    infoDiv.className = 'w3-container w3-margin-bottom w3-small w3-text-grey';
    infoDiv.style.paddingTop = '2px';

    const modeSelector = document.getElementById('mode-selector');
    if (modeSelector) {
        modeSelector.parentNode.insertBefore(infoDiv, modeSelector.nextSibling);
    }

    updateModeInfo();
}

/**
 * Update mode information display
 */
function updateModeInfo() {
    const infoDiv = document.getElementById('mode-info');
    const config = MODE_CONFIGS[currentGameMode];
    if (infoDiv && config) {
        infoDiv.textContent = config.description;
    }
}

/**
 * Handle game mode change from the select dropdown
 */
function handleModeChange(event) {
    setGameMode(event.target.value);
}

/**
 * Set the current game mode
 */
function setGameMode(mode) {
    if (!MODE_CONFIGS[mode]) return;

    if (modeState.isActive) {
        if (!confirm('Changing game mode will reset the current session. Continue?')) {
            const sel = document.getElementById('game-mode-select');
            if (sel) sel.value = currentGameMode;
            return;
        }
        stopModeTimer();
        if (typeof resetGame === 'function') resetGame();
    }

    currentGameMode = mode;
    resetModeState();
    updateModeInfo();
    updateModeUI();
}

/**
 * Reset mode state to initial values for the current mode.
 * Also calls _repModeInit() if present so repetition-mode.js can
 * initialise its own state without redeclaring this function
 * (which would cause a hoisting/recursion bug).
 */
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
        comboCount:     0,
        modeTimer:      null,
        isActive:       false
    };

    if (typeof _repModeInit === 'function') _repModeInit();

    updateModeUI();
}

/**
 * Update all mode-specific UI elements
 */
function updateModeUI() {
    updateTimerDisplay();
    updateLivesDisplay();
    updateHintsDisplay();
    updateLevelDisplay();
    updateComboDisplay();
    toggleModeElements(MODE_CONFIGS[currentGameMode]);
}


// -----------------------------------------------------------------------
// Display helpers — each creates its element lazily
// -----------------------------------------------------------------------

function _getOrCreateModeDisplay(id, labelText, valueClass) {
    let div = document.getElementById(id);
    if (!div) {
        div = document.createElement('div');
        div.id = id;
        div.className = 'w3-container w3-center w3-margin-bottom';
        div.style.paddingTop = '4px';

        const labelEl = document.createElement('span');
        labelEl.textContent = labelText;
        labelEl.className = 'w3-text-indigo';
        labelEl.style.fontWeight = 'bold';

        const display = document.createElement('span');
        display.id = id + '-value';
        display.className = valueClass + ' w3-large';
        display.style.marginLeft = '6px';

        div.appendChild(labelEl);
        div.appendChild(display);

        const landscapeCenter = document.querySelector('.landscapemode .w3-container.w3-center');
        if (landscapeCenter) landscapeCenter.appendChild(div);
    }
    return div;
}

function updateTimerDisplay() {
    const config = MODE_CONFIGS[currentGameMode];
    const div = _getOrCreateModeDisplay('mode-timer', 'Time:', 'w3-text-red');

    if (config.hasTimer) {
        const display = document.getElementById('mode-timer-value');
        if (display) display.textContent = formatTime(modeState.timeRemaining);
        div.style.display = 'block';
    } else {
        div.style.display = 'none';
    }
}

function updateLivesDisplay() {
    const config = MODE_CONFIGS[currentGameMode];
    const div = _getOrCreateModeDisplay('mode-lives', 'Lives:', 'w3-text-red');

    if (config.hasLives) {
        const display = document.getElementById('mode-lives-value');
        if (display) display.textContent = '\u2764\ufe0f'.repeat(Math.max(0, modeState.livesRemaining));
        div.style.display = 'block';
    } else {
        div.style.display = 'none';
    }
}

function updateHintsDisplay() {
    const config = MODE_CONFIGS[currentGameMode];
    const div = _getOrCreateModeDisplay('mode-hints', 'Hints:', 'w3-text-blue');

    if (config.hasHints) {
        const display = document.getElementById('mode-hints-value');
        if (display) display.textContent = '\ud83d\udca1'.repeat(Math.max(0, modeState.hintsRemaining));
        div.style.display = 'block';
    } else {
        div.style.display = 'none';
    }
}

function updateLevelDisplay() {
    const config = MODE_CONFIGS[currentGameMode];
    const div = _getOrCreateModeDisplay('mode-level', 'Level:', 'w3-text-green');

    if (config.hasLevels) {
        const display = document.getElementById('mode-level-value');
        if (display) {
            const progress = modeState.levelProgress || 0;
            const total = config.puzzlesPerLevel || 20;
            display.textContent = modeState.currentLevel + '  (' + progress + '/' + total + ')';
        }
        div.style.display = 'block';
    } else {
        div.style.display = 'none';
    }
}

function updateComboDisplay() {
    const config = MODE_CONFIGS[currentGameMode];
    const div = _getOrCreateModeDisplay('mode-combo', 'Combo:', 'w3-text-orange');

    if (config.hasCombo) {
        const display = document.getElementById('mode-combo-value');
        if (display) {
            const combo = modeState.comboCount || 0;
            display.textContent = combo > 0 ? 'x' + combo + ' \ud83d\udd25' : '\u2014';
        }
        div.style.display = 'block';
    } else {
        div.style.display = 'none';
    }
}

/**
 * Show/hide mode-specific UI elements (e.g. hint button)
 */
function toggleModeElements(config) {
    const hintSelectors = ['#btn_hint_landscape', '#btn_hint_portrait'];
    hintSelectors.forEach(sel => {
        const btn = document.querySelector(sel);
        if (!btn) return;
        if (!config.hasHints && currentGameMode !== GAME_MODES.STANDARD) {
            btn.style.display = 'none';
        }
    });
}


// -----------------------------------------------------------------------
// Timer management
// -----------------------------------------------------------------------

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
            if (modeState.timeRemaining <= 0) {
                modeState.timeRemaining = 0;
                updateTimerDisplay();
                handleTimeUp();
            }
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

    let msg;
    if (currentGameMode === GAME_MODES.THREE) {
        msg = "Time's up! You solved " + modeState.totalSolved + ' puzzles.';
    } else if (currentGameMode === GAME_MODES.HASTE) {
        msg = 'Time ran out! You solved ' + modeState.totalSolved + ' puzzles'
            + (modeState.comboCount > 0 ? ' with a combo of x' + modeState.comboCount : '') + '.';
    } else if (currentGameMode === GAME_MODES.COUNTDOWN) {
        msg = "Time's up! You solved " + modeState.totalSolved + ' puzzles.';
    }
    if (msg) endGameSession(msg);
}


// -----------------------------------------------------------------------
// Move / puzzle event hooks (called from chess-pgn-trainer.js)
// -----------------------------------------------------------------------

/**
 * Called after each correct *move* within a puzzle.
 *
 * NOTE: Repetition mode ignores this entirely — all its logic runs in
 * handlePuzzleComplete via _repetitionPuzzleComplete.
 * NOTE: Haste combo/time-gain and all totalSolved counting is done in
 * handlePuzzleComplete (puzzle granularity), not here (move granularity).
 */
function handleCorrectMove() {
    // No per-move action needed for any mode currently.
    // All scoring happens at puzzle-completion level in handlePuzzleComplete.
}

/**
 * Called after each incorrect *move* within a puzzle.
 *
 * Repetition mode ignores this — errors are counted in _repetitionPuzzleComplete
 * by reading the main app's global `error` flag after each puzzle finishes.
 */
function handleIncorrectMove() {
    if (currentGameMode === GAME_MODES.REPETITION) return;

    const config = MODE_CONFIGS[currentGameMode];

    if (currentGameMode === GAME_MODES.THREE) {
        modeState.livesRemaining = Math.max(0, modeState.livesRemaining - 1);
        updateLivesDisplay();
        if (modeState.livesRemaining <= 0) {
            endGameSession('No lives remaining! You solved ' + modeState.totalSolved + ' puzzles.');
        }
    } else if (currentGameMode === GAME_MODES.HASTE) {
        // A mistake breaks the combo and costs 30 seconds.
        modeState.comboCount = 0;
        updateComboDisplay();
        modeState.timeRemaining = Math.max(0, modeState.timeRemaining - config.timeLoss);
        updateTimerDisplay();
        if (modeState.timeRemaining <= 0) {
            handleTimeUp();
        }
    }
}

/**
 * Called when a hint is used.
 */
function handleHintUsed() {
    const config = MODE_CONFIGS[currentGameMode];
    if (!config.hasHints) return;

    modeState.hintsRemaining = Math.max(0, modeState.hintsRemaining - 1);
    updateHintsDisplay();

    if (modeState.hintsRemaining <= 0) {
        ['#btn_hint_landscape', '#btn_hint_portrait'].forEach(sel => {
            const btn = document.querySelector(sel);
            if (btn) btn.disabled = true;
        });
    }
}

/**
 * Called when a full puzzle is completed (all moves solved correctly).
 *
 * This is the correct granularity for counting solved puzzles and awarding
 * Haste combo bonuses — handleCorrectMove fires on every move within a
 * multi-move puzzle, which is too granular for combo/score accounting.
 *
 * Repetition mode is handled entirely by _repetitionPuzzleComplete().
 */
function handlePuzzleComplete() {
    if (currentGameMode === GAME_MODES.REPETITION) {
        if (typeof _repetitionPuzzleComplete === 'function') _repetitionPuzzleComplete();
        return;
    }

    modeState.totalSolved++;

    if (currentGameMode === GAME_MODES.HASTE) {
        modeState.comboCount++;

        // Award time bonus if this combo count hits a threshold milestone.
        const thresholds = MODE_CONFIGS[GAME_MODES.HASTE].comboThresholds;
        for (const t of thresholds) {
            if (modeState.comboCount === t.at) {
                modeState.timeRemaining += t.gain;
                updateTimerDisplay();
                _showHasteComboBonus('+' + t.gain + 's');
                break;
            }
        }

        updateComboDisplay();
    }
}

/**
 * Briefly shows a floating time-bonus label next to the Haste timer (e.g. "+8s").
 */
function _showHasteComboBonus(text) {
    const timerEl = document.getElementById('mode-timer');
    if (!timerEl) return;

    const el = document.createElement('span');
    el.textContent = ' ' + text;
    el.style.cssText = 'color:#4CAF50;font-weight:bold;font-size:14px;'
        + 'opacity:1;transition:opacity 1s;pointer-events:none;';
    timerEl.appendChild(el);

    // Fade out after a short moment, then remove.
    setTimeout(() => { el.style.opacity = '0'; }, 800);
    setTimeout(() => { el.remove(); }, 1400);
}


// -----------------------------------------------------------------------
// Utility
// -----------------------------------------------------------------------

function endGameSession(message) {
    stopModeTimer();
    setTimeout(() => {
        alert(message);
        if (typeof showStats === 'function') showStats();
    }, 100);
}

function formatTime(seconds) {
    const s = Math.abs(seconds);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    const sign = seconds < 0 ? '-' : '';
    return sign + String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
}

function getCurrentGameMode() { return currentGameMode; }
function getModeState()       { return modeState; }

function isHintAvailable() {
    const config = MODE_CONFIGS[currentGameMode];
    return !config.hasHints || modeState.hintsRemaining > 0;
}

/**
 * Should the main app load the next puzzle after the current one completes?
 * Repetition mode overrides this via _repetitionShouldContinue.
 */
function shouldContinueToNextPuzzle() {
    if (typeof _repetitionShouldContinue === 'function' && currentGameMode === GAME_MODES.REPETITION) {
        return _repetitionShouldContinue();
    }

    if (currentGameMode === GAME_MODES.INFINITY) return true;

    return typeof puzzleset !== 'undefined' && increment + 1 < puzzleset.length;
}/*
 * Game Modes Module for Chess PGN Trainer
 * Implements various training modes inspired by BlitzTactics
 */

// Game mode constants
const GAME_MODES = {
    STANDARD: 'standard',
    REPETITION: 'repetition',
    THREE: 'three',
    HASTE: 'haste',
    COUNTDOWN: 'countdown',
    SPEEDRUN: 'speedrun',
    INFINITY: 'infinity'
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
        timeLimit: 180, // 3 minutes in seconds
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
        baseTime: 30, // 30 seconds
        timeGain: 5,  // seconds gained on correct move
        timeLoss: 10  // seconds lost on incorrect move
    },
    [GAME_MODES.COUNTDOWN]: {
        name: 'Countdown Mode',
        description: 'Fixed total time to solve as many puzzles as possible',
        hasTimer: true,
        hasLives: false,
        hasHints: false,
        hasLevels: false,
        timeLimit: 600 // 10 minutes in seconds
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

// Current game mode state
let currentGameMode = GAME_MODES.STANDARD;
let modeState = {
    timeRemaining: 0,
    livesRemaining: 0,
    hintsRemaining: 0,
    currentLevel: 1,
    levelProgress: 0,
    levelErrors: 0,
    totalSolved: 0,
    modeTimer: null,
    isActive: false
};

/**
 * Initialize game mode system
 */
function initializeGameModes() {
    createModeSelector();
    resetModeState();
}

/**
 * Create the mode selector UI
 */
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
    
    // Add options for each game mode
    Object.entries(MODE_CONFIGS).forEach(([key, config]) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = config.name;
        select.appendChild(option);
    });
    
    select.addEventListener('change', handleModeChange);
    
    modeSelector.appendChild(label);
    modeSelector.appendChild(select);
    
    // Insert after the PGN file selector
    const pgnContainer = document.querySelector('p');
    pgnContainer.parentNode.insertBefore(modeSelector, pgnContainer.nextSibling);
    
    // Create mode info display
    createModeInfoDisplay();
}

/**
 * Create mode information display
 */
function createModeInfoDisplay() {
    const infoDiv = document.createElement('div');
    infoDiv.id = 'mode-info';
    infoDiv.className = 'w3-container w3-margin-bottom w3-small w3-text-grey';
    
    const modeSelector = document.getElementById('mode-selector');
    modeSelector.parentNode.insertBefore(infoDiv, modeSelector.nextSibling);
    
    updateModeInfo();
}

/**
 * Update mode information display
 */
function updateModeInfo() {
    const infoDiv = document.getElementById('mode-info');
    const config = MODE_CONFIGS[currentGameMode];
    
    if (infoDiv) {
        infoDiv.textContent = config.description;
    }
}

/**
 * Handle game mode change
 */
function handleModeChange(event) {
    const newMode = event.target.value;
    setGameMode(newMode);
}

/**
 * Set the current game mode
 */
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

/**
 * Reset mode state
 */
function resetModeState() {
    const config = MODE_CONFIGS[currentGameMode];
    
    modeState = {
        timeRemaining: config.timeLimit || config.baseTime || 0,
        livesRemaining: config.lives || 0,
        hintsRemaining: config.hints || 0,
        currentLevel: 1,
        levelProgress: 0,
        levelErrors: 0,
        totalSolved: 0,
        modeTimer: null,
        isActive: false
    };
    
    updateModeUI();
}

/**
 * Update mode-specific UI elements
 */
function updateModeUI() {
    const config = MODE_CONFIGS[currentGameMode];
    
    // Update timer display
    updateTimerDisplay();
    
    // Update lives display
    updateLivesDisplay();
    
    // Update hints display
    updateHintsDisplay();
    
    // Update level display
    updateLevelDisplay();
    
    // Show/hide mode-specific elements
    toggleModeElements(config);
}

/**
 * Create or update timer display
 */
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
            
            // Insert in landscape mode
            const landscapeDiv = document.querySelector('.landscapemode .w3-container.w3-center');
            if (landscapeDiv) {
                landscapeDiv.appendChild(timerDiv);
            }
        }
        
        const display = document.getElementById('timer-display');
        if (display) {
            display.textContent = formatTime(modeState.timeRemaining);
        }
        
        timerDiv.style.display = 'block';
    } else if (timerDiv) {
        timerDiv.style.display = 'none';
    }
}

/**
 * Create or update lives display
 */
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
            
            // Insert in landscape mode
            const landscapeDiv = document.querySelector('.landscapemode .w3-container.w3-center');
            if (landscapeDiv) {
                landscapeDiv.appendChild(livesDiv);
            }
        }
        
        const display = document.getElementById('lives-display');
        if (display) {
            display.textContent = '❤️'.repeat(modeState.livesRemaining);
        }
        
        livesDiv.style.display = 'block';
    } else if (livesDiv) {
        livesDiv.style.display = 'none';
    }
}

/**
 * Create or update hints display
 */
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
            
            // Insert in landscape mode
            const landscapeDiv = document.querySelector('.landscapemode .w3-container.w3-center');
            if (landscapeDiv) {
                landscapeDiv.appendChild(hintsDiv);
            }
        }
        
        const display = document.getElementById('hints-display');
        if (display) {
            display.textContent = '💡'.repeat(modeState.hintsRemaining);
        }
        
        hintsDiv.style.display = 'block';
    } else if (hintsDiv) {
        hintsDiv.style.display = 'none';
    }
}

/**
 * Create or update level display
 */
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
            
            // Insert in landscape mode
            const landscapeDiv = document.querySelector('.landscapemode .w3-container.w3-center');
            if (landscapeDiv) {
                landscapeDiv.appendChild(levelDiv);
            }
        }
        
        const display = document.getElementById('level-display');
        if (display) {
            display.textContent = `${modeState.currentLevel} (${modeState.levelProgress}/${config.puzzlesPerLevel})`;
        }
        
        levelDiv.style.display = 'block';
    } else if (levelDiv) {
        levelDiv.style.display = 'none';
    }
}

/**
 * Toggle visibility of mode-specific elements
 */
function toggleModeElements(config) {
    // Update hint button visibility based on mode
    const hintButtons = ['#btn_hint_landscape', '#btn_hint_portrait'];
    hintButtons.forEach(selector => {
        const button = document.querySelector(selector);
        if (button) {
            if (config.hasHints) {
                button.style.display = 'block';
            } else if (currentGameMode !== GAME_MODES.STANDARD) {
                button.style.display = 'none';
            }
        }
    });
}

/**
 * Start mode-specific timer
 */
function startModeTimer() {
    const config = MODE_CONFIGS[currentGameMode];
    
    if (!config.hasTimer) return;
    
    stopModeTimer(); // Clear any existing timer
    
    modeState.isActive = true;
    
    if (config.isSpeedrun) {
        // Speedrun mode - count up
        modeState.timeRemaining = 0;
        modeState.modeTimer = setInterval(() => {
            modeState.timeRemaining++;
            updateTimerDisplay();
        }, 1000);
    } else {
        // Count down modes
        modeState.modeTimer = setInterval(() => {
            modeState.timeRemaining--;
            updateTimerDisplay();
            
            if (modeState.timeRemaining <= 0) {
                handleTimeUp();
            }
        }, 1000);
    }
}

/**
 * Stop mode timer
 */
function stopModeTimer() {
    if (modeState.modeTimer) {
        clearInterval(modeState.modeTimer);
        modeState.modeTimer = null;
    }
    modeState.isActive = false;
}

/**
 * Handle time up event
 */
function handleTimeUp() {
    stopModeTimer();
    
    const config = MODE_CONFIGS[currentGameMode];
    
    if (currentGameMode === GAME_MODES.THREE) {
        endGameSession('Time\'s up! Session ended.');
    } else if (currentGameMode === GAME_MODES.HASTE) {
        endGameSession('Time ran out! Session ended.');
    } else if (currentGameMode === GAME_MODES.COUNTDOWN) {
        endGameSession(`Time's up! You solved ${modeState.totalSolved} puzzles.`);
    }
}

/**
 * Handle correct move in current mode
 */
function handleCorrectMove() {
    const config = MODE_CONFIGS[currentGameMode];
    
    // Repetition mode handles its own puzzle completion logic
    if (currentGameMode === GAME_MODES.REPETITION) {
        return;
    }

    modeState.totalSolved++;
    
    if (currentGameMode === GAME_MODES.HASTE) {
        // Add time for correct move
        modeState.timeRemaining += config.timeGain;
        updateTimerDisplay();
    } else if (currentGameMode === GAME_MODES.REPETITION) {
        // Handled in assets/repetition-mode.js via handlePuzzleComplete
        return;
    }
}

/**
 * Handle incorrect move in current mode
 */
function handleIncorrectMove() {
    const config = MODE_CONFIGS[currentGameMode];
    
    // Repetition mode handles its own mistake logic
    if (currentGameMode === GAME_MODES.REPETITION) {
        return;
    }

    if (currentGameMode === GAME_MODES.THREE) {
        modeState.livesRemaining--;
        updateLivesDisplay();
        
        if (modeState.livesRemaining <= 0) {
            endGameSession('No lives remaining! Session ended.');
            return;
        }
    } else if (currentGameMode === GAME_MODES.HASTE) {
        // Lose time for incorrect move
        modeState.timeRemaining -= config.timeLoss;
        if (modeState.timeRemaining < 0) {
            modeState.timeRemaining = 0;
        }
        updateTimerDisplay();
        
        if (modeState.timeRemaining <= 0) {
            handleTimeUp();
            return;
        }
    }
}

/**
 * Handle hint usage in current mode
 */
function handleHintUsed() {
    const config = MODE_CONFIGS[currentGameMode];
    
    if (config.hasHints) {
        modeState.hintsRemaining--;
        updateHintsDisplay();
        
        if (modeState.hintsRemaining <= 0) {
            // Disable hint buttons
            const hintButtons = ['#btn_hint_landscape', '#btn_hint_portrait'];
            hintButtons.forEach(selector => {
                const button = document.querySelector(selector);
                if (button) {
                    button.disabled = true;
                }
            });
        }
    }
}

/**
 * Restart current level in repetition mode
 */
function restartCurrentLevel() {
    modeState.levelProgress = 0;
    modeState.levelErrors = 0;
    updateLevelDisplay();
    
    setTimeout(() => {
        alert(`Level ${modeState.currentLevel} failed! Restarting level due to errors.`);
        // Reset to beginning of current level
        resetToLevelStart();
    }, 100);
}

/**
 * Reset to start of current level
 */
function resetToLevelStart() {
    const config = MODE_CONFIGS[currentGameMode];
    const levelStartIndex = (modeState.currentLevel - 1) * config.puzzlesPerLevel;
    
    // Reset increment to level start
    increment = levelStartIndex;
    
    // Reset puzzle order for this level if randomized
    if ($('#randomizeSet').is(':checked')) {
        const levelEnd = Math.min(levelStartIndex + config.puzzlesPerLevel, puzzleset.length);
        const levelRange = Array.from({length: levelEnd - levelStartIndex}, (_, i) => levelStartIndex + i);
        const shuffledLevel = shuffle(levelRange);
        
        // Replace the level portion in PuzzleOrder
        for (let i = 0; i < shuffledLevel.length; i++) {
            PuzzleOrder[levelStartIndex + i] = shuffledLevel[i];
        }
    }
    
    // Load first puzzle of level
    if (increment < puzzleset.length) {
        loadPuzzle(puzzleset[PuzzleOrder[increment]]);
    }
}

/**
 * End game session with message
 */
function endGameSession(message) {
    stopModeTimer();
    
    // Show completion message
    setTimeout(() => {
        alert(message);
        showResults();
    }, 100);
}

/**
 * Format time in MM:SS format
 */
function formatTime(seconds) {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.abs(seconds) % 60;
    const sign = seconds < 0 ? '-' : '';
    return `${sign}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get current game mode
 */
function getCurrentGameMode() {
    return currentGameMode;
}

/**
 * Get mode state
 */
function getModeState() {
    return modeState;
}

/**
 * Check if hint is available in current mode
 */
function isHintAvailable() {
    const config = MODE_CONFIGS[currentGameMode];
    return !config.hasHints || modeState.hintsRemaining > 0;
}

/**
 * Check if game should continue to next puzzle
 */
function shouldContinueToNextPuzzle() {
    const config = MODE_CONFIGS[currentGameMode];
    
    if (currentGameMode === GAME_MODES.INFINITY) {
        return true; // Always continue in infinity mode
    }
    
    if (currentGameMode === GAME_MODES.REPETITION) {
        // Continue within current level
        const levelStartIndex = (modeState.currentLevel - 1) * config.puzzlesPerLevel;
        const levelEndIndex = Math.min(levelStartIndex + config.puzzlesPerLevel, puzzleset.length);
        return increment + 1 < levelEndIndex;
    }
    
    return increment + 1 < puzzleset.length;
}

// Export functions for use in main script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GAME_MODES,
        MODE_CONFIGS,
        initializeGameModes,
        setGameMode,
        getCurrentGameMode,
        getModeState,
        startModeTimer,
        stopModeTimer,
        handleCorrectMove,
        handleIncorrectMove,
        handleHintUsed,
        isHintAvailable,
        shouldContinueToNextPuzzle,
        resetModeState,
        updateModeUI
    };
}

