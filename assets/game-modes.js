/*
 * Game Modes Module for Chess PGN Trainer
 * Implements various training modes
 *
 * Repetition mode logic is fully integrated here.
 * repetition-mode.js is no longer needed and should be deleted.
 *
 * Infinity Mode is now a full Spaced Repetition (SM-2) mode.
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
        hasTimer: false, hasLives: false, hasHints: false, hasLevels: false
    },
    [GAME_MODES.REPETITION]: {
        name: 'Repetition Mode',
        description: 'Complete levels perfectly to unlock the next (20 puzzles per level)',
        hasTimer: false, hasLives: false, hasHints: false, hasLevels: true,
        puzzlesPerLevel: 20
    },
    [GAME_MODES.THREE]: {
        name: 'Three Mode',
        description: '3 minutes, 3 lives, 3 hints',
        hasTimer: true, hasLives: true, hasHints: true, hasLevels: false,
        timeLimit: 180, lives: 3, hints: 3
    },
    [GAME_MODES.HASTE]: {
        name: 'Haste Mode',
        description: 'Start with base time, gain/lose time on correct/incorrect moves',
        hasTimer: true, hasLives: false, hasHints: false, hasLevels: false,
        baseTime: 30, timeGain: 5, timeLoss: 10
    },
    [GAME_MODES.COUNTDOWN]: {
        name: 'Countdown Mode',
        description: 'Fixed total time to solve as many puzzles as possible',
        hasTimer: true, hasLives: false, hasHints: false, hasLevels: false,
        timeLimit: 600
    },
    [GAME_MODES.SPEEDRUN]: {
        name: 'Speedrun Mode',
        description: 'Complete all puzzles as fast as possible',
        hasTimer: true, hasLives: false, hasHints: false, hasLevels: false,
        isSpeedrun: true
    },
    [GAME_MODES.INFINITY]: {
        name: 'Spaced Repetition',
        description: 'Puzzles you struggle with appear more often. Progress is saved across sessions.',
        hasTimer: false, hasLives: false, hasHints: false, hasLevels: false
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
    levelProgress:  0,
    levelErrors:    0,
    totalSolved:    0,
    modeTimer:      null,
    isActive:       false
};

// Repetition-mode tracking
let repetitionSetStartIndex = 0;
let repetitionSetHadError   = false;

// ---------------------------------------------------------------------------
// ═══════════════════════════════════════════════════════════════════════════
//  SPACED REPETITION (SM-2) — Infinity Mode
// ═══════════════════════════════════════════════════════════════════════════
//
//  Each puzzle has a "card" stored in localStorage under the key
//  'sr_cards_<pgnFile>'.  A card looks like:
//
//    {
//      index:       <number>   -- index into puzzleset[]
//      interval:    <days>     -- current review interval (starts 1)
//      easeFactor:  <float>    -- SM-2 ease factor (starts 2.5, min 1.3)
//      repetitions: <number>   -- consecutive correct solves
//      nextReview:  <ms>       -- Date.now() value when due next
//      due:         <boolean>  -- convenience flag set at queue-build time
//    }
//
//  The session queue (srQueue) is an ordered list of puzzle indices built
//  fresh each time the user presses Start.  It is stored in PuzzleOrder so
//  the rest of chess-pgn-trainer.js works without modification.
//
//  Per-puzzle error tracking uses srCurrentPuzzleHadError (reset each puzzle).
// ---------------------------------------------------------------------------

const SR_STORAGE_PREFIX = 'sr_cards_';

let srCards           = {};   // map: puzzleIndex → card object
let srCurrentPgnFile  = '';   // key used to load/save cards
let srCurrentPuzzleHadError = false;  // reset at each puzzle start

// ── Persistence ─────────────────────────────────────────────────────────────

function srGetStorageKey() {
    return SR_STORAGE_PREFIX + srCurrentPgnFile;
}

function srLoadCards() {
    const raw = localStorage.getItem(srGetStorageKey());
    srCards = raw ? JSON.parse(raw) : {};
}

function srSaveCards() {
    localStorage.setItem(srGetStorageKey(), JSON.stringify(srCards));
}

function srClearCards() {
    localStorage.removeItem(srGetStorageKey());
    srCards = {};
}

// ── Card initialisation ──────────────────────────────────────────────────────

function srGetCard(puzzleIndex) {
    if (!srCards[puzzleIndex]) {
        srCards[puzzleIndex] = {
            index:       puzzleIndex,
            interval:    1,
            easeFactor:  2.5,
            repetitions: 0,
            nextReview:  Date.now(),   // new cards are immediately due
            due:         true
        };
    }
    return srCards[puzzleIndex];
}

// ── SM-2 update ──────────────────────────────────────────────────────────────
//
//  quality: 5 = perfect, 3 = correct with effort, 0 = total blackout
//  We map our binary outcome to:
//    clean solve  → quality 4
//    had error    → quality 1  (interval resets)

function srApplySM2(card, quality) {
    // Update ease factor
    card.easeFactor = Math.max(
        1.3,
        card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );

    const msPerDay = 24 * 60 * 60 * 1000;

    if (quality < 3) {
        // Failed — reset streak and make immediately due again
        card.repetitions = 0;
        card.interval    = 1;
        card.nextReview  = Date.now();   // due right now, not tomorrow
        card.due         = true;
    } else {
        // Passed
        if (card.repetitions === 0)      card.interval = 1;
        else if (card.repetitions === 1) card.interval = 6;
        else                             card.interval = Math.round(card.interval * card.easeFactor);

        card.repetitions++;
        card.nextReview = Date.now() + card.interval * msPerDay;
        card.due        = false;
    }
}

// ── Queue builder ────────────────────────────────────────────────────────────
//
//  Called by srInitSession() to construct PuzzleOrder for this session.
//  Order: overdue cards (sorted by most overdue first) → new cards → future cards.

function srBuildQueue(totalPuzzles) {
    srLoadCards();

    const now   = Date.now();
    const due   = [];
    const fresh = [];   // never seen
    const future= [];   // not yet due

    for (let i = 0; i < totalPuzzles; i++) {
        if (!srCards[i]) {
            fresh.push(i);
        } else {
            const card = srCards[i];
            card.due = card.nextReview <= now;
            if (card.due) {
                due.push({ i, overdue: now - card.nextReview });
            } else {
                future.push({ i, nextReview: card.nextReview });
            }
        }
    }

    // Sort overdue by most overdue first, future by soonest first
    due.sort((a, b) => b.overdue - a.overdue);
    future.sort((a, b) => a.nextReview - b.nextReview);

    const queue = [
        ...due.map(x => x.i),
        ...fresh,
        ...future.map(x => x.i)
    ];

    return queue;
}

// ── Session initialisation ───────────────────────────────────────────────────
//
//  Called from startTest() via the hook below when mode is Infinity.
//  Builds the queue and writes it into PuzzleOrder so the engine works normally.

function srInitSession() {
    srCurrentPgnFile = ($('#openPGN').val() || 'default').replace(/[^a-zA-Z0-9]/g, '_');
    const queue = srBuildQueue(puzzleset.length);
    PuzzleOrder = queue;
    increment   = 0;
    srCurrentPuzzleHadError = false;
    srUpdateStatsDisplay();
}

// ── Per-puzzle hooks ─────────────────────────────────────────────────────────

function srOnPuzzleStart() {
    srCurrentPuzzleHadError = false;
}

function srOnError() {
    srCurrentPuzzleHadError = true;
}

function srOnPuzzleComplete() {
    const puzzleIndex = PuzzleOrder[increment];
    const card        = srGetCard(puzzleIndex);
    const quality     = srCurrentPuzzleHadError ? 1 : 4;
    srApplySM2(card, quality);
    srSaveCards();
    srCurrentPuzzleHadError = false;
    srUpdateStatsDisplay();
}

// ── Queue cycling ─────────────────────────────────────────────────────────────
//
//  After each puzzle in Infinity mode, rebuild the queue from the updated cards.
//  This means newly-failed puzzles re-appear sooner in the next cycle.
//  chess-pgn-trainer.js will do increment += 1 after this returns, so we
//  set increment to -1 here to land on index 0 of the fresh queue.

function srAdvance() {
    const queue = srBuildQueue(puzzleset.length);
    PuzzleOrder = queue;
    increment   = -1;   // caller does += 1, so we start at 0
}

// ── Stats display ─────────────────────────────────────────────────────────────

function srUpdateStatsDisplay() {
    let statsDiv = document.getElementById('sr-stats');
    if (!statsDiv) {
        statsDiv = document.createElement('div');
        statsDiv.id = 'sr-stats';
        statsDiv.className = 'w3-container w3-center w3-margin-bottom w3-small';
        const landscapeDiv = document.querySelector('.landscapemode .w3-container.w3-center');
        if (landscapeDiv) landscapeDiv.appendChild(statsDiv);
    }

    if (currentGameMode !== GAME_MODES.INFINITY) {
        statsDiv.style.display = 'none';
        return;
    }

    const now   = Date.now();
    let due     = 0;
    let learned = 0;
    let newCount= 0;

    for (let i = 0; i < puzzleset.length; i++) {
        const card = srCards[i];
        if (!card || card.repetitions === 0) {
            // Never seen, or seen but never cleanly solved — count as new/unseen
            if (card && card.nextReview <= now) {
                due++;   // failed before, due again now
            } else {
                newCount++;
            }
        } else {
            // Has at least one clean solve
            if (card.nextReview <= now) {
                due++;
            } else {
                learned++;
            }
        }
    }

    statsDiv.innerHTML =
        `<span style="color:#e53935;">⏰ Due: ${due}</span> &nbsp;|&nbsp; ` +
        `<span style="color:#43a047;">✓ Learned: ${learned}</span> &nbsp;|&nbsp; ` +
        `<span style="color:#1e88e5;">★ New: ${newCount}</span>`;
    statsDiv.style.display = 'block';
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

function initializeGameModes() {
    const select = document.getElementById('game-mode-select-manual');
    if (select) {
        select.addEventListener('change', handleModeChange);
    }
    resetModeState();
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
            const select = document.getElementById('game-mode-select-manual');
            if (select) select.value = currentGameMode;
            return;
        }
        stopModeTimer();
        resetGame();
    }

    currentGameMode = mode;
    const select = document.getElementById('game-mode-select-manual');
    if (select) select.value = mode;
    resetModeState();
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

    repetitionSetStartIndex = 0;
    repetitionSetHadError   = false;

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
    srUpdateStatsDisplay();
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
// ---------------------------------------------------------------------------

function handleCorrectMove() {
    if (currentGameMode === GAME_MODES.REPETITION) return;
    if (currentGameMode === GAME_MODES.INFINITY)   return;  // handled at puzzle level

    modeState.totalSolved++;
    if (currentGameMode === GAME_MODES.HASTE) {
        modeState.timeRemaining += MODE_CONFIGS[currentGameMode].timeGain;
        updateTimerDisplay();
    }
}

function handleIncorrectMove() {
    if (currentGameMode === GAME_MODES.REPETITION) {
        repetitionSetHadError = true;
        return;
    }
    if (currentGameMode === GAME_MODES.INFINITY) {
        srOnError();
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

function handlePuzzleComplete() {
    if (currentGameMode === GAME_MODES.REPETITION) {
        if (!repetitionSetHadError) {
            modeState.levelProgress++;
        }
        updateLevelDisplay();
        return;
    }

    if (currentGameMode === GAME_MODES.INFINITY) {
        srOnPuzzleComplete();
        return;
    }
}

function handleHintUsed() {
    if (currentGameMode === GAME_MODES.INFINITY) {
        // Treat hint as an error for spaced repetition scoring
        srOnError();
    }
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
// Puzzle start notification
// Called from loadPuzzle() in chess-pgn-trainer.js via the hook below.
// ---------------------------------------------------------------------------

function handlePuzzleStart() {
    if (currentGameMode === GAME_MODES.INFINITY) {
        srOnPuzzleStart();
    }
}

// ---------------------------------------------------------------------------
// Puzzle advancement
// ---------------------------------------------------------------------------

function shouldContinueToNextPuzzle() {
    if (currentGameMode === GAME_MODES.INFINITY) {
        // Rebuild the queue after every puzzle so updated card scores take effect.
        // Set increment to -1 so that after caller does += 1 we land on index 0.
        srAdvance();
        return true;
    }

    if (currentGameMode === GAME_MODES.REPETITION) {
        const config = MODE_CONFIGS[GAME_MODES.REPETITION];
        const puzzlesCompletedInSet = (increment - repetitionSetStartIndex) + 1;

        if (puzzlesCompletedInSet < config.puzzlesPerLevel) {
            repetitionSetHadError = false;
            return true;
        }

        const setWasClean = !repetitionSetHadError &&
                            modeState.levelProgress >= config.puzzlesPerLevel;
        repetitionSetHadError = false;

        if (setWasClean) {
            modeState.currentLevel++;
            modeState.levelProgress  = 0;
            repetitionSetStartIndex  = increment + 1;
            updateLevelDisplay();
            alert(`Level ${modeState.currentLevel - 1} complete! Starting Level ${modeState.currentLevel}.`);
            return true;
        } else {
            modeState.levelProgress = 0;
            increment = repetitionSetStartIndex - 1;
            updateLevelDisplay();
            alert(`Set not clean. Restarting Level ${modeState.currentLevel}.`);
            return true;
        }
    }

    return increment + 1 < puzzleset.length;
}

// ---------------------------------------------------------------------------
// Hook called by startTest() in chess-pgn-trainer.js
// Allows Infinity mode to override PuzzleOrder before the first puzzle loads.
// ---------------------------------------------------------------------------

function onStartTest() {
    if (currentGameMode === GAME_MODES.INFINITY) {
        srInitSession();
    }
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
// Module export
// ---------------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GAME_MODES, MODE_CONFIGS,
        initializeGameModes, setGameMode,
        getCurrentGameMode, getModeState,
        startModeTimer, stopModeTimer,
        handleCorrectMove, handleIncorrectMove,
        handlePuzzleComplete, handlePuzzleStart, handleHintUsed,
        isHintAvailable, shouldContinueToNextPuzzle,
        onStartTest, resetModeState, updateModeUI,
        srClearCards
    };
}
