function saveProgress(setIndex) {
    localStorage.setItem("repetitionSetIndex", setIndex.toString());
}

function loadProgress() {
    const val = localStorage.getItem("repetitionSetIndex");
    return val ? parseInt(val) : 0;
}

function clearProgress() {
    localStorage.removeItem("repetitionSetIndex");
}

/**
 * Saves the current game state to local storage
 * @param {Object} state - The game state object to save
 */
function saveGameState(state) {
    localStorage.setItem('savedGameState', JSON.stringify(state));
}

/**
 * Loads the saved game state from local storage
 * @returns {Object|null} The saved game state or null if not found
 */
function loadGameState() {
    const state = localStorage.getItem('savedGameState');
    return state ? JSON.parse(state) : null;
}

/**
 * Clears the saved game state from local storage
 */
function clearSavedGameState() {
    localStorage.removeItem('savedGameState');
}
