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
    INFINITY:   'infinity',
    WOODPECKER: 'woodpecker'
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
    },
    [GAME_MODES.WOODPECKER]: {
        name: 'Woodpecker',
        description: 'Complete the full set. Each cycle must be faster than the last.',
        hasTimer: true, hasLives: false, hasHints: false, hasLevels: false
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

// Woodpecker mode tracking
let wpData = null;          // loaded wp_data for current PGN
let wpCurrentPgn = null;    // name of current Woodpecker PGN
const WP_STORAGE_PREFIX = 'wp_data_';

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
//
//  Within-session retry: failed puzzles are reinserted ~4 positions ahead in
//  the live queue (srQueue), not immediately next and not at the very front.
//  Cross-session: on clean solve the SM-2 card is updated and saved.
//  If the session ends while a puzzle is still failing, its card already has
//  nextReview in the past so it comes back first next session.
// ---------------------------------------------------------------------------

const SR_STORAGE_PREFIX  = 'sr_cards_';
let SR_INITIAL_EASE   = 2.5;
let SR_MIN_EASE       = 1.3;
let SR_REINSERT_AFTER  = 4;   // reinsert failed card this many puzzles later
const SR_PARAMS_KEY = 'sr_params';
const SR_HISTORY_KEY = 'sr_history';

let srCards                 = {};   // puzzleIndex → SM-2 card, persisted to localStorage
let srCurrentPgnFile        = '';   // key suffix for localStorage
let srCurrentPuzzleHadError = false;// true if any wrong move on the current puzzle
let srQueue                 = [];   // live ordered list of puzzle indices for this session
// srQueue is the source of truth within a session; PuzzleOrder is kept in sync.
// Failed puzzles are spliced back into srQueue at position (currentPos + SR_REINSERT_AFTER).
// srPendingRetry tracks which puzzles are currently awaiting a retry in srQueue,
// so we don't apply SM-2 until they're solved cleanly.
let srPendingRetry          = new Set();

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
    // Also persist to IndexedDB when available (fire-and-forget)
    if (window.ChessDB && typeof ChessDB.srSaveAllCards === 'function' && srCurrentPgnFile) {
        ChessDB.srSaveAllCards(srCurrentPgnFile, srCards).catch(console.error);
    }
}

function srClearCards() {
    localStorage.removeItem(srGetStorageKey());
    srCards = {};
    // Clear from IndexedDB as well
    if (window.ChessDB && typeof ChessDB.srClearCards === 'function' && srCurrentPgnFile) {
        ChessDB.srClearCards(srCurrentPgnFile).catch(console.error);
    }
}

// ── Card initialisation ──────────────────────────────────────────────────────

function srGetCard(puzzleIndex) {
    if (!srCards[puzzleIndex]) {
        srCards[puzzleIndex] = {
            index:       puzzleIndex,
            interval:    1,
            easeFactor:  SR_INITIAL_EASE,
            repetitions: 0,
            nextReview:  Date.now(),  // new cards are immediately due
            due:         true
        };
    }
    return srCards[puzzleIndex];
}

// ── SM-2 update ──────────────────────────────────────────────────────────────
//  Only called on a CLEAN solve (no errors, or cleaned up after retry).
//  quality 4 = first-time clean; quality 1 = eventually cleaned after errors.
//  Failed cards pending retry keep nextReview in the past so they're overdue
//  if the session ends before they're solved.

function srApplySM2(card, quality) {
    card.easeFactor = Math.max(
        SR_MIN_EASE,
        card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );

    const msPerDay = 24 * 60 * 60 * 1000;

    if (quality < 3) {
        // Shouldn't happen in normal flow (we only call SM-2 on clean solve)
        // but guard just in case.
        card.repetitions = 0;
        card.interval    = 1;
        card.nextReview  = Date.now() - 1;
        card.due         = true;
    } else {
        if (card.repetitions === 0)      card.interval = 1;
        else if (card.repetitions === 1) card.interval = 6;
        else card.interval = Math.round(card.interval * card.easeFactor);

        card.repetitions++;
        card.nextReview = Date.now() + card.interval * msPerDay;
        card.due        = false;
    }
}

// ── Initial queue builder ────────────────────────────────────────────────────
//  Builds the queue at session start from card history.
//  Order: overdue (most overdue first) → new (never seen) → future (not yet due).

function srBuildInitialQueue(totalPuzzles) {
    const now    = Date.now();
    const due    = [];
    const fresh  = [];
    const future = [];

    for (let i = 0; i < totalPuzzles; i++) {
        const card = srCards[i];
        if (!card) {
            fresh.push(i);
        } else if (card.nextReview <= now) {
            due.push({ i, overdue: now - card.nextReview });
        } else {
            future.push({ i, nextReview: card.nextReview });
        }
    }

    due.sort((a, b) => b.overdue - a.overdue);
    future.sort((a, b) => a.nextReview - b.nextReview);

    return [
        ...due.map(x => x.i),
        ...fresh,
        ...future.map(x => x.i)
    ];
}

// ── Session initialisation ───────────────────────────────────────────────────

function srInitSession() {
    srCurrentPgnFile        = ($('#openPGN').val() || 'default').replace(/[^a-zA-Z0-9]/g, '_');
    srCurrentPuzzleHadError = false;
    srPendingRetry          = new Set();
    srLoadCards();

    srQueue     = srBuildInitialQueue(puzzleset.length);
    PuzzleOrder = srQueue;
    increment   = 0;
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
    const puzzleIndex  = srQueue[increment];
    const wasInRetry   = srPendingRetry.has(puzzleIndex);

    if (srCurrentPuzzleHadError) {
        // Failed this attempt.
        // Log the failure
        srLogResult(0, 1);
        
        // 1. Mark the card as overdue right now so it survives a session close.
        const card = srGetCard(puzzleIndex);
        card.nextReview = Date.now() - 1;
        card.due        = true;
        srSaveCards();

        // 2. Add to pending retry set so we know it needs a clean solve.
        srPendingRetry.add(puzzleIndex);

        // 3. Reinsert into srQueue ~SR_REINSERT_AFTER positions ahead.
        //    We insert AFTER increment because increment hasn't been bumped yet
        //    (caller does += 1 after this returns via srAdvance → no-op path).
        const insertAt = Math.min(
            increment + SR_REINSERT_AFTER,
            srQueue.length   // append at end if queue is short
        );
        srQueue.splice(insertAt, 0, puzzleIndex);
        PuzzleOrder = srQueue;

        srCurrentPuzzleHadError = false;
        srUpdateStatsDisplay();
        return;
    }

    // Clean solve.
    // Log the success
    srLogResult(1, 0);
    
    // Determine quality: penalised (1) if this was a retry, full (4) if first-time clean.
    const quality = wasInRetry ? 1 : 4;
    const card    = srGetCard(puzzleIndex);
    srApplySM2(card, quality);
    srSaveCards();

    // Remove from pending retry — it's been mastered for this session.
    srPendingRetry.delete(puzzleIndex);

    srCurrentPuzzleHadError = false;
    srUpdateStatsDisplay();
}

// ── Queue advance ─────────────────────────────────────────────────────────────
//  Called by shouldContinueToNextPuzzle after every puzzle.
//  Returns true if there is a next puzzle to load, false if the session is done.

function srAdvance() {
    const nextIncrement = increment + 1;

    if (nextIncrement < srQueue.length) {
        // Queue still has items ahead — continue normally.
        return true;
    }

    // Reached the end of the queue. Check if there's anything left to do.
    const now       = Date.now();
    const hasPending = srPendingRetry.size > 0;
    const hasDueOrNew = [...Array(puzzleset.length).keys()].some(i => {
        if (srPendingRetry.has(i)) return false; // already counted
        const card = srCards[i];
        return !card || card.nextReview <= now;  // new or overdue
    });

    if (!hasPending && !hasDueOrNew) {
        // Nothing left due or pending — session is genuinely complete.
        return false;
    }

    // There are still pending retries or due cards — rebuild queue and continue.
    const retryList = [...srPendingRetry];
    const baseQueue = srBuildInitialQueue(puzzleset.length);
    const retrySet  = new Set(retryList);
    const remainder = baseQueue.filter(i => !retrySet.has(i));

    srQueue     = [...retryList, ...remainder];
    PuzzleOrder = srQueue;
    increment   = -1;  // caller does += 1, lands on 0
    return true;
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

    const now    = Date.now();
    let due      = srPendingRetry.size;  // currently failing this session
    let learned  = 0;
    let newCount = 0;

    for (let i = 0; i < puzzleset.length; i++) {
        if (srPendingRetry.has(i)) continue;  // already counted above
        const card = srCards[i];
        if (!card) {
            newCount++;
        } else if (card.nextReview <= now) {
            due++;      // overdue from a previous session
        } else if (card.repetitions > 0) {
            learned++;  // at least one clean solve, scheduled for future
        } else {
            newCount++; // seen but no clean solve yet, not currently pending
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
    srLoadParams();
    // Sync input values to loaded params
    document.getElementById('sr-initial-ease').value   = SR_INITIAL_EASE;
    document.getElementById('sr-min-ease').value        = SR_MIN_EASE;
    document.getElementById('sr-reinsert-after').value  = SR_REINSERT_AFTER;
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

    // Initialize Woodpecker mode if selected
    if (currentGameMode === GAME_MODES.WOODPECKER) {
        if (typeof puzzleset !== 'undefined' && puzzleset.length > 0) {
			const pgnName = ($('#openPGN').val() || 'default').replace(/[^a-zA-Z0-9]/g, '_');
            const resumeIndex = typeof wpCheckResume === 'function' ? wpCheckResume(pgnName, puzzleset.length) : 0;
            if (typeof wpStartCycle === 'function') {
                wpStartCycle(pgnName, puzzleset.length);
            }
            if (resumeIndex > 0) {
                increment = resumeIndex - 1;
            }
        }
    }

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
    updateWpUI();
    // Show/hide SR parameters row based on mode
    const srRow = document.getElementById('sr-params-row');
    if (srRow) srRow.style.display = currentGameMode === GAME_MODES.INFINITY ? 'table-row' : 'none';
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
    // Show/hide SR Dashboard button based on mode
    const srBtn = document.getElementById('btn_sr_dashboard');
    if (srBtn) srBtn.style.display = currentGameMode === GAME_MODES.INFINITY ? 'block' : 'none';
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
    if (currentGameMode === GAME_MODES.WOODPECKER) {
        // Record mistake but DO NOT end session — Woodpecker continues regardless
        if (wpData && wpData.currentCycle && typeof getCurrentPuzzleIndex === 'function') {
            const idx = getCurrentPuzzleIndex();
            wpRecordMistake(idx);
        }
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

	if (currentGameMode === GAME_MODES.WOODPECKER && typeof wpUpdateLastPuzzleIndex === 'function') {
		const idx = typeof getCurrentPuzzleIndex === 'function'
			? getCurrentPuzzleIndex()
			: (typeof PuzzleOrder !== 'undefined' && PuzzleOrder.length > 0 ? PuzzleOrder[increment] : increment);
		if (typeof idx === 'number') {
			wpUpdateLastPuzzleIndex(idx);
			updateWpUI();
		}
	}
}

// ---------------------------------------------------------------------------
// Puzzle advancement
// ---------------------------------------------------------------------------

function shouldContinueToNextPuzzle() {
    if (currentGameMode === GAME_MODES.WOODPECKER) {
        // Woodpecker always advances regardless of mistakes
        return increment + 1 < puzzleset.length;
    }

    if (currentGameMode === GAME_MODES.INFINITY) {
        const hasMore = srAdvance();
        if (!hasMore) {
            // All due and pending puzzles solved — show completion message.
            setTimeout(() => {
                alert('Session complete! All due puzzles have been solved. Come back tomorrow for your next review.');
            }, 50);
        }
        return hasMore;
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

	// Standard and other modes.
	// During a Mistake Review session we only want to walk the subset
	// stored in PuzzleOrder (indices in the original puzzleset).
	if (typeof isMistakeReviewActive !== 'undefined' && isMistakeReviewActive) {
		const total = (typeof PuzzleOrder !== 'undefined' && Array.isArray(PuzzleOrder))
			? PuzzleOrder.length
			: puzzleset.length;
		return increment + 1 < total;
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

/**
 * Get the current puzzle index within puzzleset for the active puzzle.
 * Uses PuzzleOrder when available, falling back to increment.
 *
 * @returns {number} Index into puzzleset for the current puzzle.
 */
function getCurrentPuzzleIndex() {
	if (typeof PuzzleOrder !== 'undefined' && Array.isArray(PuzzleOrder) &&
		typeof increment !== 'undefined') {
		const idx = PuzzleOrder[increment];
		if (typeof idx === 'number') {
			return idx;
		}
	}
	return typeof increment === 'number' ? increment : 0;
}

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

// ── SR Parameter Management ──────────────────────────────────────────────────

/**
 * Load SR parameters from localStorage
 */
function srLoadParams() {
    const raw = localStorage.getItem(SR_PARAMS_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (p.initialEase)   SR_INITIAL_EASE   = p.initialEase;
    if (p.minEase)       SR_MIN_EASE       = p.minEase;
    if (p.reinsertAfter) SR_REINSERT_AFTER = p.reinsertAfter;
}

/**
 * Save SR parameters to localStorage
 */
function srSaveParams() {
    localStorage.setItem(SR_PARAMS_KEY, JSON.stringify({
        initialEase: SR_INITIAL_EASE, minEase: SR_MIN_EASE, reinsertAfter: SR_REINSERT_AFTER
    }));
}

/**
 * Update a single SR parameter with validation and persistence
 */
function srUpdateParam(param, value) {
    const v = parseFloat(value);
    if (isNaN(v)) return;
    if (param === 'initialEase')   SR_INITIAL_EASE   = Math.max(1.3, Math.min(3.5, v));
    if (param === 'minEase')       SR_MIN_EASE       = Math.max(1.0, Math.min(2.0, v));
    if (param === 'reinsertAfter') SR_REINSERT_AFTER = Math.max(1,   Math.min(10, Math.round(v)));
    srSaveParams();
}


// ── SR Dashboard & Export/Import ──────────────────────────────────────────────

/**
 * Display the SR Dashboard with card statistics and export/import options
 */
function showSRDashboard() {
    const tbody = document.getElementById('sr-dashboard-tbody');
    const summary = document.getElementById('sr-dashboard-summary');
    if (!tbody) return;
    tbody.innerHTML = '';
    const now = Date.now(), msPerDay = 86400000;
    let totalNew = 0, totalDue = 0, totalLearned = 0;

    for (let i = 0; i < puzzleset.length; i++) {
        const card = srCards[i];
        const name = (puzzleset[i] && puzzleset[i].Event) || `Puzzle ${i + 1}`;
        let reps = '—', interval = '—', ease = '—', nextReview = 'New', status = '★ New';

        if (card) {
            reps = card.repetitions;
            interval = `${card.interval}d`;
            ease = card.easeFactor.toFixed(2);
            const daysUntil = Math.round((card.nextReview - now) / msPerDay);
            if (daysUntil <= 0) { nextReview = 'Due now'; status = '⏰ Due'; totalDue++; }
            else if (daysUntil === 1) { nextReview = 'Tomorrow'; status = '✓'; totalLearned++; }
            else { nextReview = `In ${daysUntil}d`; status = '✓'; totalLearned++; }
        } else { totalNew++; }

        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i+1}</td><td>${name}</td><td>${reps}</td>
                        <td>${interval}</td><td>${ease}</td><td>${nextReview}</td><td>${status}</td>`;
        tbody.appendChild(tr);
    }

    summary.innerHTML =
        `<span class="w3-tag w3-red w3-round">⏰ Due: ${totalDue}</span> &nbsp;` +
        `<span class="w3-tag w3-green w3-round">✓ Learned: ${totalLearned}</span> &nbsp;` +
        `<span class="w3-tag w3-blue w3-round">★ New: ${totalNew}</span>`;

    const graphDiv = document.getElementById('sr-retention-graph');
    if (graphDiv) graphDiv.innerHTML = srBuildSparkline();

    document.getElementById('modal_sr_dashboard').style.display = 'block';
}

/**
 * Export SR cards as JSON file
 */
function srExportJSON() {
    const data = { exportDate: new Date().toISOString(), pgnFile: srCurrentPgnFile, cards: srCards };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `sr-backup-${srCurrentPgnFile}-${new Date().toJSON().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
}

/**
 * Export SR cards as CSV file
 */
function srExportCSV() {
    const now = Date.now(), msPerDay = 86400000;
    const rows = [['Index','Puzzle','Repetitions','Interval (days)','Ease Factor','Next Review','Days Until Review']];
    for (let i = 0; i < puzzleset.length; i++) {
        const card = srCards[i];
        const name = (puzzleset[i] && puzzleset[i].Event) || `Puzzle ${i+1}`;
        if (card) {
            rows.push([i+1, name, card.repetitions, card.interval, card.easeFactor.toFixed(2),
                       new Date(card.nextReview).toLocaleDateString(),
                       Math.round((card.nextReview - now) / msPerDay)]);
        } else {
            rows.push([i+1, name, 0, '—', '—', 'New', '—']);
        }
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `sr-data-${srCurrentPgnFile}-${new Date().toJSON().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
}

/**
 * Trigger file picker for JSON import
 */
function srImportJSON() { document.getElementById('sr-import-input').click(); }

/**
 * Handle JSON file import
 */
function srHandleImport(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.cards) {
                srCards = data.cards;
                srSaveCards();
                alert('SR data imported. Restart session to apply.');
                showSRDashboard();
            } else { alert('Invalid SR backup file.'); }
        } catch (err) { alert('Parse error: ' + err.message); }
    };
    reader.readAsText(file);
    input.value = '';
}

/**
 * Build a 7-day sparkline graph of SR performance
 */
function srBuildSparkline() {
    const raw = localStorage.getItem(SR_HISTORY_KEY);
    const history = raw ? JSON.parse(raw) : {};
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toJSON().slice(0, 10);
        days.push({ label: key.slice(5), ...(history[key] || { correct: 0, incorrect: 0 }) });
    }
    const W = 280, H = 80, pad = 20;
    const maxVal = Math.max(1, ...days.map(d => d.correct + d.incorrect));
    const barW = (W - pad * 2) / days.length;
    let svg = `<svg width="${W}" height="${H + 20}" xmlns="http://www.w3.org/2000/svg" style="font-family:sans-serif;font-size:10px">`;
    days.forEach((d, i) => {
        const x = pad + i * barW;
        const cH = (d.correct / maxVal) * H;
        const eH = (d.incorrect / maxVal) * H;
        const tH = cH + eH;
        if (eH > 0) svg += `<rect x="${x+1}" y="${H-tH}" width="${barW-2}" height="${eH}" fill="#e53935" opacity="0.8"/>`;
        if (cH > 0) svg += `<rect x="${x+1}" y="${H-tH+eH}" width="${barW-2}" height="${cH}" fill="#43a047" opacity="0.8"/>`;
        svg += `<text x="${x+barW/2}" y="${H+14}" text-anchor="middle" fill="#888">${d.label}</text>`;
    });
    svg += `<line x1="${pad}" y1="${H}" x2="${W-pad}" y2="${H}" stroke="#ccc" stroke-width="1"/>`;
    svg += `</svg>`;
    return svg;
}


/**
 * Log SR puzzle result (correct or incorrect) to daily history
 */
function srLogResult(correct, incorrect) {
    const today = new Date().toJSON().slice(0, 10);
    const raw = localStorage.getItem(SR_HISTORY_KEY);
    const history = raw ? JSON.parse(raw) : {};
    if (!history[today]) history[today] = { correct: 0, incorrect: 0 };
    history[today].correct   += correct;
    history[today].incorrect += incorrect;
    localStorage.setItem(SR_HISTORY_KEY, JSON.stringify(history));

    // Mirror daily history into IndexedDB for long-term retention graphs
    if (window.ChessDB && typeof ChessDB.srLogDay === 'function') {
        const pgnKey = srCurrentPgnFile || 'legacy';
        ChessDB.srLogDay(pgnKey, today, correct, incorrect).catch(console.error);
    }
}


// ---------------------------------------------------------------------------
// WOODPECKER METHOD MODE - Storage Functions
// ---------------------------------------------------------------------------

/**
 * Get the localStorage key for a Woodpecker PGN file
 */
function wpStorageKey(pgnName) {
    return WP_STORAGE_PREFIX + pgnName;
}

/**
 * Load Woodpecker data for a PGN file from localStorage
 */
function wpLoad(pgnName) {
    wpCurrentPgn = pgnName;
    const raw = localStorage.getItem(wpStorageKey(pgnName));
    wpData = raw ? JSON.parse(raw) : { cycleHistory: [], currentCycle: null };
    return wpData;
}

/**
 * Save current Woodpecker data to localStorage
 */
function wpSave() {
    if (!wpCurrentPgn) return;
    localStorage.setItem(wpStorageKey(wpCurrentPgn), JSON.stringify(wpData));

    // Mirror Woodpecker current + history into IndexedDB when available
    if (window.ChessDB) {
        const pgnKey = wpCurrentPgn;
        try {
            if (wpData && wpData.currentCycle && typeof ChessDB.wpSaveCurrent === 'function') {
                ChessDB.wpSaveCurrent(pgnKey, wpData.currentCycle).catch(console.error);
            }
            if (wpData && Array.isArray(wpData.cycleHistory) && typeof ChessDB.wpSaveCompletedCycle === 'function') {
                wpData.cycleHistory.forEach(cycle => {
                    ChessDB.wpSaveCompletedCycle(pgnKey, cycle).catch(console.error);
                });
            }
        } catch (e) {
            console.error('[Woodpecker] Failed to mirror data to IndexedDB', e);
        }
    }
}

/**
 * Get the time (in ms) of the last completed cycle
 */
function wpGetLastCycleMs() {
    if (!wpData || wpData.cycleHistory.length === 0) return null;
    return wpData.cycleHistory[wpData.cycleHistory.length - 1].totalMs;
}

/**
 * Get the current cycle number (next cycle to start)
 */
function wpGetCycleNumber() {
    if (!wpData) return 1;
    return wpData.cycleHistory.length + 1;
}

/**
 * Start a new Woodpecker cycle
 */
function wpStartCycle(pgnName, puzzleCount) {
    wpLoad(pgnName);
    if (!wpData.currentCycle) {
        wpData.currentCycle = {
            cycleNumber: wpGetCycleNumber(),
            startedAt: Date.now(),
            puzzleCount: puzzleCount,
            mistakesThisCycle: [],
            lastPuzzleIndex: 0
        };
        wpSave();
    }
    updateWpUI();
}

/**
 * Record a mistake in the current Woodpecker cycle
 */
function wpRecordMistake(puzzleIndex) {
    if (!wpData || !wpData.currentCycle) return;
    if (!wpData.currentCycle.mistakesThisCycle.includes(puzzleIndex)) {
        wpData.currentCycle.mistakesThisCycle.push(puzzleIndex);
        wpSave();
    }
}

/**
 * Update the last puzzle index in the current cycle (for resume support)
 */
function wpUpdateLastPuzzleIndex(index) {
    if (!wpData || !wpData.currentCycle) return;
    wpData.currentCycle.lastPuzzleIndex = index;
    wpSave();
}

/**
 * Complete the current Woodpecker cycle and return cycle data
 */
function wpCompleteCycle() {
    if (!wpData || !wpData.currentCycle) return null;
    const elapsed = Date.now() - wpData.currentCycle.startedAt;
    const completedCycle = {
        cycleNumber: wpData.currentCycle.cycleNumber,
        totalMs: elapsed,
        puzzleCount: wpData.currentCycle.puzzleCount,
        mistakeCount: wpData.currentCycle.mistakesThisCycle.length,
        completedAt: new Date().toISOString().split('T')[0],
        mistakeIndexes: wpData.currentCycle.mistakesThisCycle
    };
    wpData.cycleHistory.push(completedCycle);
    wpData.currentCycle = null;
    wpSave();

    // Also append to IndexedDB history and clear current entry if available
    if (window.ChessDB && typeof ChessDB.wpSaveCompletedCycle === 'function') {
        const pgnKey = wpCurrentPgn;
        ChessDB.wpSaveCompletedCycle(pgnKey, completedCycle)
            .then(() => {
                if (typeof ChessDB.wpClearCurrent === 'function') {
                    return ChessDB.wpClearCurrent(pgnKey);
                }
            })
            .catch(console.error);
    }
    return completedCycle;
}

/**
 * Check if there's an in-progress cycle and offer to resume
 */
function wpCheckResume(pgnName, puzzleCount) {
    wpLoad(pgnName);
    if (wpData.currentCycle) {
        const elapsed = msToHMS(Date.now() - wpData.currentCycle.startedAt);
        const confirmed = confirm(
            `You have an in-progress Cycle ${wpData.currentCycle.cycleNumber} ` +
            `(elapsed: ${elapsed}, at puzzle ${wpData.currentCycle.lastPuzzleIndex + 1}/${puzzleCount}). Resume it?`
        );
        if (confirmed) {
            return wpData.currentCycle.lastPuzzleIndex;
        } else {
            wpData.currentCycle = null;
            wpSave();
        }
    }
    return 0;
}

/**
 * Convert milliseconds to HH:MM:SS format
 */
function msToHMS(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':');
}

/**
 * Update Woodpecker UI display
 */
function updateWpUI() {
    const display = document.getElementById('wp-status-display');
    if (!display) return;
    const isWp = currentGameMode === GAME_MODES.WOODPECKER;
    display.style.display = isWp ? 'block' : 'none';
    if (!isWp || !wpData) return;

    const cycleEl = document.getElementById('wp-cycle-number');
    if (cycleEl) cycleEl.textContent = wpGetCycleNumber();

    const lastMs = wpGetLastCycleMs();
    const prevRow = document.getElementById('wp-prev-time-row');
    const targetEl = document.getElementById('wp-target-time');
    if (lastMs && prevRow && targetEl) {
        prevRow.style.display = 'block';
        targetEl.textContent = msToHMS(lastMs);
    }

    const mistakeEl = document.getElementById('wp-mistake-count');
    if (mistakeEl && wpData.currentCycle) {
        mistakeEl.textContent = wpData.currentCycle.mistakesThisCycle.length;
    }
}


/**
 * Build a cycle history bar chart as inline SVG
 */
function wpBuildCycleChart(history) {
    if (!history || history.length === 0) return '';
    const W = 300, H = 80, pad = 4;
    const maxMs = Math.max(...history.map(c => c.totalMs));
    const barW = Math.floor((W - pad * (history.length + 1)) / history.length);

    const bars = history.map((c, i) => {
        const barH = Math.round((c.totalMs / maxMs) * (H - 20));
        const x = pad + i * (barW + pad);
        const y = H - barH - 16;
        const color = i === 0 ? '#888' : c.totalMs < history[i - 1].totalMs ? '#4caf50' : '#e53935';
        return `
            <rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${color}" rx="2"/>
            <text x="${x + barW / 2}" y="${H - 2}" text-anchor="middle"
                  font-size="9" fill="#aaa">${c.cycleNumber}</text>
        `;
    }).join('');

    return `<svg width="${W}" height="${H}" style="display:block;margin:auto;">
        ${bars}
        <text x="${W/2}" y="${H}" text-anchor="middle" font-size="9" fill="#888">Cycle</text>
    </svg>`;
}

/**
 * Populate the flagged puzzles list in the results modal
 */
function wpPopulateFlaggedList(mistakeIndexes) {
    const section = document.getElementById('wp-flagged-section');
    const list = document.getElementById('wp-flagged-list');
    if (!section || !list || !mistakeIndexes || mistakeIndexes.length === 0) {
        if (section) section.style.display = 'none';
        return;
    }
    section.style.display = 'block';
    list.innerHTML = mistakeIndexes.map(idx => {
		let name = `Puzzle ${idx + 1}`;
		if (typeof puzzleset !== 'undefined' && puzzleset[idx]) {
			const puzzle = puzzleset[idx];
			if (puzzle && puzzle.Event) {
				// Strip basic HTML tags for display in plain list.
				name = puzzle.Event.replace(/<br\s*\/?>/gi, ' ').replace(/<\/?[^>]+(>|$)/g, '');
			}
		}
        return `<li>${name}</li>`;
    }).join('');
}
