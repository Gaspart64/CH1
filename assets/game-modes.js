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
        description: 'Endless play — puzzles loop forever.',
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
    comboCount:     0,
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

    Object.entries(MODE_CONFIG).forEach(([key, config]) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = config.name;
        select.appendChild(option);
    });

    select.addEventListener('change', handleModeChange);

    modeSelector.appendChild(label);
    modeSelector.appendChild(select);

    // Restore original insertion after the <p> tag containing the file selector
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

function handleModeChange(event) {
    setGameMode(event.target.value);
}

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

function updateModeUI() {
    updateTimerDisplay();
    updateLivesDisplay();
    updateHintsDisplay();
    updateLevelDisplay();
    updateComboDisplay();
    toggleModeElements(MODE_CONFIGS[currentGameMode]);
}

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
        if (display) display.textContent = '❤️'.repeat(Math.max(0, modeState.livesRemaining));
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
        if (display) display.textContent = '💡'.repeat(Math.max(0, modeState.hintsRemaining));
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
            display.textContent = modeState.currentLevel + ' (' + progress + '/' + total + ')';
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
            display.textContent = combo > 0 ? 'x' + combo + ' 🔥' : '—';
        }
        div.style.display = 'block';
    } else {
        div.style.display = 'none';
    }
}

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
    let msg = "Time's up! You solved " + modeState.totalSolved + " puzzles.";
    if (currentGameMode === GAME_MODES.HASTE && modeState.comboCount > 0) {
        msg += " (Max combo: x" + modeState.comboCount + ")";
    }
    endGameSession(msg);
}

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
        modeState.comboCount = 0;
        updateComboDisplay();
        modeState.timeRemaining = Math.max(0, modeState.timeRemaining - config.timeLoss);
        updateTimerDisplay();
        if (modeState.timeRemaining <= 0) handleTimeUp();
    }
}

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

function handlePuzzleComplete() {
    if (currentGameMode === GAME_MODES.REPETITION) {
        if (typeof _repetitionPuzzleComplete === 'function') _repetitionPuzzleComplete();
        return;
    }

    modeState.totalSolved++;

    if (currentGameMode === GAME_MODES.HASTE) {
        modeState.comboCount++;
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

function _showHasteComboBonus(text) {
    const timerEl = document.getElementById('mode-timer');
    if (!timerEl) return;
    const el = document.createElement('span');
    el.textContent = ' ' + text;
    el.style.cssText = 'color:#4CAF50;font-weight:bold;font-size:14px;opacity:1;transition:opacity 1s;pointer-events:none;';
    timerEl.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; }, 800);
    setTimeout(() => { el.remove(); }, 1400);
}

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

function shouldContinueToNextPuzzle() {
    if (typeof _repetitionShouldContinue === 'function' && currentGameMode === GAME_MODES.REPETITION) {
        return _repetitionShouldContinue();
    }
    if (currentGameMode === GAME_MODES.INFINITY) return true;
    return typeof puzzleset !== 'undefined' && increment + 1 < puzzleset.length;
}
