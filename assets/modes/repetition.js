// Repetition Mode for Chess PGN Trainer

const RepetitionMode = (function () {
    let levels = [];
    let currentLevelIndex = 0;
    let currentLevelPuzzles = [];
    let increment = 0;
    let errorcount = 0;
    let startDateTime = null;
    let pauseDateTimeTotal = 0;
    let stats = {};
    let onLevelCompleteCallback = null;

    const REPETITION_MAX_TIME_PER_PUZZLE = 30; // seconds
    let puzzleTimer = null;
    let puzzleStartTime = null;

    // Partition puzzles into levels
    function partitionPuzzles(puzzles, levelSize) {
        let out = [];
        for (let i = 0; i < puzzles.length; i += levelSize) {
            out.push(puzzles.slice(i, i + levelSize));
        }
        return out;
    }

    // Populate level selector dropdown
    function populateLevelSelector(levelCount) {
        let $selector = $('#repetitionLevelSelector');
        $selector.empty();
        for (let i = 0; i < levelCount; i++) {
            $selector.append(`<option value="${i}">Level ${i + 1}</option>`);
        }
    }

    // Start a level
    function startLevel(levelIndex) {
        currentLevelIndex = levelIndex;
        currentLevelPuzzles = levels[levelIndex];
        increment = 0;
        errorcount = 0;
        startDateTime = new Date();
        pauseDateTimeTotal = 0;
        loadCurrentPuzzle();
        updateProgressBar(0, currentLevelPuzzles.length);
    }

    // Load the current puzzle
    function loadCurrentPuzzle() {
        if (typeof window.loadPuzzle === 'function') {
            window.loadPuzzle(currentLevelPuzzles[increment]);
        }
        window.error = false;
        // Start per-puzzle timer
        if (puzzleTimer) clearTimeout(puzzleTimer);
        puzzleStartTime = Date.now();
        puzzleTimer = setTimeout(function() {
            alert(`Too slow! You must solve each puzzle in under ${REPETITION_MAX_TIME_PER_PUZZLE} seconds. Restarting level.`);
            startLevel(currentLevelIndex); // Reset the level
        }, REPETITION_MAX_TIME_PER_PUZZLE * 1000);
    }

    // Call this after each puzzle is solved correctly
    function onPuzzleSolved() {
        if (puzzleTimer) clearTimeout(puzzleTimer);
        increment++;
        updateProgressBar(increment, currentLevelPuzzles.length);
        if (increment < currentLevelPuzzles.length) {
            loadCurrentPuzzle();
        } else {
            onLevelComplete();
        }
    }

    // Called when a level is finished
    function onLevelComplete() {
        const endDateTime = new Date();
        const elapsedSeconds = (endDateTime - startDateTime - pauseDateTimeTotal) / 1000;
        const elapsedTime = new Date(elapsedSeconds * 1000).toISOString().slice(11, 19);
        stats = {
            level: currentLevelIndex + 1,
            errors: errorcount,
            totaltime: elapsedTime,
            setlength: currentLevelPuzzles.length,
        };
        if (typeof onLevelCompleteCallback === 'function') {
            onLevelCompleteCallback(currentLevelIndex, stats);
        } else {
            alert(`Level ${currentLevelIndex + 1} complete!\nErrors: ${errorcount}\nTime: ${elapsedTime}`);
        }
    }

    // Increment error and (optionally) reset timer for current puzzle
    function incrementError() {
        errorcount++;
        // Optionally reset timer for current puzzle
        if (puzzleTimer) clearTimeout(puzzleTimer);
        puzzleStartTime = Date.now();
        puzzleTimer = setTimeout(function() {
            alert(`Too slow! You must solve each puzzle in under ${REPETITION_MAX_TIME_PER_PUZZLE} seconds. Restarting level.`);
            startLevel(currentLevelIndex);
        }, REPETITION_MAX_TIME_PER_PUZZLE * 1000);
    }

    // Public API
    return {
        init: function (puzzles, levelSize, callback) {
            levels = partitionPuzzles(puzzles, levelSize);
            onLevelCompleteCallback = callback;
            populateLevelSelector(levels.length);
            startLevel(0);
        },
        startLevel: startLevel,
        onPuzzleSolved: onPuzzleSolved,
        incrementError: incrementError,
        getCurrentLevel: function () { return currentLevelIndex; },
        getLevelsCount: function () { return levels.length; },
        getStats: function () { return stats; },
        getCurrentPuzzle: function () { return currentLevelPuzzles[increment]; }
    };
})();

// Level selector event
$('#repetitionLevelSelector').off('change').on('change', function() {
    RepetitionMode.startLevel(parseInt($(this).val()));
});
