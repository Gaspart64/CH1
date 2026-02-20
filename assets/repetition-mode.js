/*
 * Repetition Mode for Chess PGN Trainer
 *
 * Registers two hook functions that game-modes.js calls:
 *   _repetitionPuzzleComplete()  — after every puzzle is fully solved
 *   _repetitionShouldContinue() — decides if main app loads next puzzle
 *
 * Does NOT manage its own puzzle index. The main app's `increment` is the
 * single source of truth; we only rewind it on level restart.
 */

// -----------------------------------------------------------------------
// Progress persistence
// -----------------------------------------------------------------------

function saveProgress(idx)  { try { localStorage.setItem('repetitionSetIndex', String(idx)); } catch(e){} }
function loadProgress()     { try { const v = localStorage.getItem('repetitionSetIndex'); return v ? parseInt(v, 10) : 0; } catch(e){ return 0; } }
function clearProgress()    { try { localStorage.removeItem('repetitionSetIndex'); } catch(e){} }


// -----------------------------------------------------------------------
// State
// -----------------------------------------------------------------------

// Derive level size from the single source of truth in game-modes.js so
// the two files can never get out of sync.
const REP_LEVEL_SIZE = (typeof MODE_CONFIGS !== 'undefined' && MODE_CONFIGS.repetition)
    ? MODE_CONFIGS.repetition.puzzlesPerLevel
    : 20;

let repState = {
    currentLevel:        1,
    levelStartIncrement: 0,
    levelErrors:         0,
    restarting:          false
};

function repLevelEnd() {
    if (typeof puzzleset === 'undefined' || !puzzleset) return repState.levelStartIncrement + REP_LEVEL_SIZE;
    return Math.min(repState.levelStartIncrement + REP_LEVEL_SIZE, puzzleset.length);
}

function repPuzzlesDoneInLevel() {
    return (increment - repState.levelStartIncrement) + 1;
}

function syncRepDisplay() {
    if (typeof modeState === 'undefined') return;
    
    modeState.currentLevel  = repState.currentLevel;
    
    // Ensure progress is at least 1 when a level starts
    let progress = repPuzzlesDoneInLevel();
    if (progress <= 0) progress = 1; 
    
    modeState.levelProgress = progress;
    modeState.levelErrors   = repState.levelErrors;
    
    if (typeof updateLevelDisplay === 'function') updateLevelDisplay();
}

// -----------------------------------------------------------------------
// Banner
// -----------------------------------------------------------------------

function showRepBanner(msg, ms) {
    let el = document.getElementById('rep-banner');
    if (!el) {
        el = document.createElement('div');
        el.id = 'rep-banner';
        el.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);background:#3F51B5;color:#fff;padding:10px 28px;border-radius:8px;font-size:15px;font-weight:bold;z-index:9999;box-shadow:0 2px 10px rgba(0,0,0,.4);pointer-events:none;transition:opacity .35s';
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => { el.style.display = 'none'; }, 380);
    }, ms || 2400);
}


// -----------------------------------------------------------------------
// Level restart
// -----------------------------------------------------------------------

function doLevelRestart() {
    if (repState.restarting) return;
    repState.restarting = true;
    repState.levelErrors = 0;
    increment = repState.levelStartIncrement;
    syncRepDisplay();

    setTimeout(() => {
        repState.restarting = false;
        if (typeof puzzleset !== 'undefined' && puzzleset.length > 0 &&
            typeof PuzzleOrder !== 'undefined' && typeof loadPuzzle === 'function') {
            loadPuzzle(puzzleset[PuzzleOrder[increment]]);
        }
    }, 350);
}


// -----------------------------------------------------------------------
// Hook registered in game-modes.js
// -----------------------------------------------------------------------

function _repetitionPuzzleComplete() {
    if (typeof error !== 'undefined' && error) repState.levelErrors++;

    const done    = repPuzzlesDoneInLevel();
    const levelSz = repLevelEnd() - repState.levelStartIncrement;

    syncRepDisplay();

    if (done >= levelSz) {
        if (repState.levelErrors === 0) {
            const nextStart = repLevelEnd();
            repState.currentLevel++;
            repState.levelStartIncrement = nextStart;
            repState.levelErrors = 0;
            saveProgress(nextStart);
            syncRepDisplay();
            showRepBanner('🎉 Level ' + (repState.currentLevel - 1) + ' complete! Starting Level ' + repState.currentLevel, 2800);
        } else {
            const errCount = repState.levelErrors;
            showRepBanner(errCount + ' error' + (errCount !== 1 ? 's' : '') + ' — restarting Level ' + repState.currentLevel + ' from puzzle 1', 2800);
            doLevelRestart();
        }
    }
}

function _repetitionShouldContinue() {
    if (typeof puzzleset === 'undefined' || !puzzleset) return false;

    const done    = repPuzzlesDoneInLevel();
    const levelSz = repLevelEnd() - repState.levelStartIncrement;

    if (done >= levelSz) {
        if (repState.levelErrors > 0) return false; // restart will handle it
        return increment + 1 < puzzleset.length;    // perfect — advance
    }
    return increment + 1 < puzzleset.length;
}


// -----------------------------------------------------------------------
// resetModeState extension
//
// IMPORTANT: We must NOT redeclare resetModeState() with a `function`
// declaration here. Both files are in the same global scope and function
// declarations are hoisted to the top of the scope at parse time, so the
// last declaration always wins regardless of file load order. That means
// the _baseModeReset capture below would end up pointing at this very
// function, causing infinite recursion.
//
// Instead we register an initializer that game-modes.js's resetModeState
// calls at the end via the _repModeInit hook.
// -----------------------------------------------------------------------

/**
 * Called by game-modes.js resetModeState() at the end of every reset.
 * Initialises or clears repetition-specific state.
 */
function _repModeInit() {
    repState = {
        currentLevel:        1,
        levelStartIncrement: 0,
        levelErrors:         0,
        restarting:          false
    };

    if (typeof getCurrentGameMode === 'function' && getCurrentGameMode() === 'repetition') {
        const savedStart = loadProgress();
        repState.levelStartIncrement = savedStart;
        repState.currentLevel = Math.floor(savedStart / REP_LEVEL_SIZE) + 1;
        syncRepDisplay();
    }
}
