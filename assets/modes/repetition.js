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
        // Reset error flag for this puzzle
        window.error = false;
    }

    // Call this after each puzzle is solved correctly
    function onPuzzleSolved() {
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
        incrementError: function () { errorcount++; },
        getCurrentLevel: function () { return currentLevelIndex; },
        getLevelsCount: function () { return levels.length; },
        getStats: function () { return stats; },
        getCurrentPuzzle: function () { return currentLevelPuzzles[increment]; }
    };
})();

// Example HTML to add to your page:
// <select id="repetitionLevelSelector"></select>

// Example integration in your main JS (after loading puzzleset):
// RepetitionMode.init(puzzleset, 20, function(levelIndex, stats) {
//   // Show stats or move to next level
//   alert(`Level ${levelIndex + 1} complete!\nErrors: ${stats.errors}\nTime: ${stats.totaltime}`);
// });
// $('#repetitionLevelSelector').on('change', function() {
//   RepetitionMode.startLevel(parseInt($(this).val()));
// });

// In your puzzle completion logic, call:
// RepetitionMode.onPuzzleSolved();
// On error, call:
// RepetitionMode.incrementError();

// In your checkAndPlayNext or similar, only call onPuzzleSolved when the user solves the puzzle correctly.
