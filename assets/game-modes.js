/*
 * Game Modes Module for Chess PGN Trainer
 */

const GAME_MODES = {
    STANDARD:   'standard',
    REPETITION: 'repetition',
    THREE:      'three',
    HASTE:      'haste',
    COUNTDOWN:  'countdown',
    SPEEDRUN:   'speedrun',
    INFINITY:   'infinity'
};

const MODE_CONFIGS = {
    [GAME_MODES.STANDARD]: {
        name: 'Standard Mode',
        description: 'Play puzzles sequentially from a PGN file',
        hasTimer: false, hasLives: false, hasHints: false, hasLevels: false
    },
    [GAME_MODES.REPETITION]: {
        name: 'Repetition Mode',
        description: 'Complete 20 puzzles with no errors to advance. Any mistake restarts the level.',
        hasTimer: false, hasLives: false, hasHints: false, hasLevels: true,
        puzzlesPerLevel: 20
    },
    [GAME_MODES.THREE]: {
        name: 'Three Mode',
        description: '3 minutes, 3 lives, 3 hints.',
        hasTimer: true, hasLives: true, hasHints: true, hasLevels: false,
        timeLimit: 180, lives: 3, hints: 3
    },
    [GAME_MODES.HASTE]: {
        name: 'Haste Mode',
        description: 'Build combos to gain time. Each mistake costs 30 seconds.',
        hasTimer: true, hasLives: false, hasHints: false, hasLevels: false,
        baseTime: 180, timeLoss: 30,
        comboThresholds: [
            { at: 2, gain: 3 }, { at: 5, gain: 5 }, { at: 10, gain: 8 }, 
            { at: 20, gain: 12 }, { at: 30, gain: 15 }
        ]
    },
    [GAME_MODES.COUNTDOWN]: {
        name: 'Countdown Mode',
        description: 'Solve as many puzzles as possible in 10 minutes.',
        hasTimer: true, hasLives: false, hasHints: false, hasLevels: false,
        timeLimit: 600
    },
    [GAME_MODES.SPEEDRUN]: {
        name: 'Speedrun Mode',
        description: 'Complete all puzzles as fast as possible.',
        hasTimer: true, hasLives: false, hasHints: false, hasLevels: false,
        isSpeedrun: true
    },
    [GAME_MODES.INFINITY]: {
        name: 'Infinity Mode',
        description: 'Endless play — puzzles loop forever.',
        hasTimer: false, hasLives: false, hasHints: false, hasLevels: false,
        isInfinite: true
    }
};

let currentGameMode = GAME_MODES.STANDARD;
let modeState = {
    timeRemaining: 0, livesRemaining: 0, hintsRemaining: 0,
    currentLevel: 1, levelProgress: 0, levelErrors: 0,
    totalSolved: 0, comboCount: 0, isActive: false
};

function initializeGameModes() {
    createModeSelector();
    resetModeState();
}

function createModeSelector() {
    if (document.getElementById('mode-selector')) return;
    const container = document.createElement('div');
    container.id = 'mode-selector';
    container.className = 'w3-container w3-margin-bottom';
    container.innerHTML = `<label class="w3-text-indigo" style="font-weight:bold">Game Mode: </label>
                           <select id="game-mode-select" class="w3-select w3-border w3-round" style="width:200px;display:inline-block;margin-left:8px;font-size:13px;"></select>`;
    
    const select = container.querySelector('select');
    Object.entries(MODE_CONFIGS).forEach(([key, cfg]) => {
        const opt = document.createElement('option');
        opt.value = key; opt.textContent = cfg.name;
        select.appendChild(opt);
    });
    select.addEventListener('change', (e) => setGameMode(e.target.value));
    
    const pgnContainer = document.querySelector('p');
    if (pgnContainer) pgnContainer.parentNode.insertBefore(container, pgnContainer.nextSibling);
    createModeInfoDisplay();
}

function createModeInfoDisplay() {
    const info = document.createElement('div');
    info.id = 'mode-info';
    info.className = 'w3-container w3-margin-bottom w3-small w3-text-grey';
    const selector = document.getElementById('mode-selector');
    if (selector) selector.parentNode.insertBefore(info, selector.nextSibling);
    updateModeInfo();
}

function updateModeInfo() {
    const info = document.getElementById('mode-info');
    if (info) info.textContent = MODE_CONFIGS[currentGameMode].description;
}

function setGameMode(mode) {
    if (modeState.isActive && !confirm('Reset session?')) {
        document.getElementById('game-mode-select').value = currentGameMode;
        return;
    }
    stopModeTimer();
    currentGameMode = mode;
    if (typeof resetGame === 'function') resetGame();
    resetModeState();
    updateModeInfo();
}

function resetModeState() {
    const cfg = MODE_CONFIGS[currentGameMode];
    modeState = {
        timeRemaining: cfg.timeLimit || cfg.baseTime || 0,
        livesRemaining: cfg.lives || 0,
        hintsRemaining: cfg.hints || 0,
        currentLevel: 1, levelProgress: 0, levelErrors: 0,
        totalSolved: 0, comboCount: 0, isActive: false
    };
    if (typeof _repModeInit === 'function') _repModeInit();
    updateModeUI();
}

function updateModeUI() {
    updateTimerDisplay(); updateLivesDisplay(); updateHintsDisplay();
    updateLevelDisplay(); updateComboDisplay();
}

function _getDisplay(id, label, color) {
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement('div');
        el.id = id;
        el.className = 'w3-container w3-center w3-margin-bottom';
        el.innerHTML = `<span class="w3-text-indigo" style="font-weight:bold">${label}</span>
                        <span id="${id}-value" class="${color} w3-large" style="margin-left:6px"></span>`;
        const center = document.querySelector('.landscapemode .w3-container.w3-center');
        if (center) center.appendChild(el);
    }
    return el;
}

function updateTimerDisplay() {
    const el = _getDisplay('mode-timer', 'Time:', 'w3-text-red');
    el.style.display = MODE_CONFIGS[currentGameMode].hasTimer ? 'block' : 'none';
    const val = document.getElementById('mode-timer-value');
    if (val) val.textContent = formatTime(modeState.timeRemaining);
}

function updateLivesDisplay() {
    const el = _getDisplay('mode-lives', 'Lives:', 'w3-text-red');
    el.style.display = MODE_CONFIGS[currentGameMode].hasLives ? 'block' : 'none';
    const val = document.getElementById('mode-lives-value');
    if (val) val.textContent = '❤️'.repeat(Math.max(0, modeState.livesRemaining));
}

function updateHintsDisplay() {
    const el = _getDisplay('mode-hints', 'Hints:', 'w3-text-blue');
    el.style.display = MODE_CONFIGS[currentGameMode].hasHints ? 'block' : 'none';
    const val = document.getElementById('mode-hints-value');
    if (val) val.textContent = '💡'.repeat(Math.max(0, modeState.hintsRemaining));
}

function updateLevelDisplay() {
    const el = _getDisplay('mode-level', 'Level:', 'w3-text-green');
    el.style.display = MODE_CONFIGS[currentGameMode].hasLevels ? 'block' : 'none';
    const val = document.getElementById('mode-level-value');
    if (val) {
        const p = modeState.levelProgress || 0;
        const t = MODE_CONFIGS[currentGameMode].puzzlesPerLevel || 20;
        val.textContent = `${modeState.currentLevel} (${p}/${t})`;
    }
}

function updateComboDisplay() {
    const el = _getDisplay('mode-combo', 'Combo:', 'w3-text-orange');
    el.style.display = MODE_CONFIGS[currentGameMode].hasCombo ? 'block' : 'none';
    const val = document.getElementById('mode-combo-value');
    if (val) val.textContent = modeState.comboCount > 0 ? `x${modeState.comboCount} 🔥` : '—';
}

function handlePuzzleComplete() {
    if (currentGameMode === GAME_MODES.REPETITION) {
        if (typeof _repetitionPuzzleComplete === 'function') _repetitionPuzzleComplete();
    } else {
        modeState.totalSolved++;
        if (currentGameMode === GAME_MODES.HASTE) {
            modeState.comboCount++;
            updateComboDisplay();
        }
    }
}

function handleIncorrectMove() {
    if (currentGameMode === GAME_MODES.THREE) {
        modeState.livesRemaining--;
        updateLivesDisplay();
        if (modeState.livesRemaining <= 0) alert('Game Over!');
    }
}

function formatTime(s) {
    const m = Math.floor(Math.abs(s) / 60);
    const sec = Math.abs(s) % 60;
    return `${s < 0 ? '-' : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function stopModeTimer() { /* Timer logic here */ }
function startModeTimer() { /* Timer logic here */ }
function getCurrentGameMode() { return currentGameMode; }
function shouldContinueToNextPuzzle() {
    if (currentGameMode === GAME_MODES.REPETITION && typeof _repetitionShouldContinue === 'function') {
        return _repetitionShouldContinue();
    }
    return typeof puzzleset !== 'undefined' && increment + 1 < puzzleset.length;
}
