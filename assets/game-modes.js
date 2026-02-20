/*
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
    INFINITY: 'infinity',
    REVERSE: 'reverse'
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
    },
    [GAME_MODES.REVERSE]: {
        name: 'Reverse Mode',
        description: 'Solve puzzles backward: last move first, then last two, and so on',
        hasTimer: false,
        hasLives: false,
        hasHints: true,
        hasLevels: false,
        isReverse: true
    }
};

// Current game mode state
let currentGameMode = GAME_MODES.STANDARD;
let isResettingMode = false;
let modeState = {
    timeRemaining: 0,
    livesRemaining: 0,
    hintsRemaining: 0,
    currentLevel: 1,
    levelProgress: 0,
    levelErrors: 0,
    totalSolved: 0,
    modeTimer: null,
    isActive: false,
    reverseStep: 1 // Current number of moves to solve in reverse mode
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
    // Use the existing selector in the HTML
    const select = document.getElementById('game-mode-select-manual');
    if (select) {
        select.id = 'game-mode-select';
        select.addEventListener('change', handleModeChange);
    }
    
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
    
    const modeSelector = document.getElementById('game-mode-select');
    if (modeSelector) {
        modeSelector.parentNode.insertBefore(infoDiv, modeSelector.nextSibling);
    } else {
        // Fallback
        const pgnContainer = document.querySelector('p');
        if (pgnContainer) pgnContainer.parentNode.insertBefore(infoDiv, pgnContainer.nextSibling);
    }
    
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
            const select = document.getElementById('game-mode-select');
            if (select) select.value = currentGameMode;
            return;
        }
        stopModeTimer();
        // resetGame calls resetModeState, which we want to avoid infinite loop
        // but resetGame is needed to clear the board and state
        resetGame();
    }
    
    currentGameMode = mode;
    const select = document.getElementById('game-mode-select');
    if (select) select.value = mode;
    resetModeState();
    updateModeInfo();
    updateModeUI();
}

/**
 * Reset mode state
 */
function resetModeState() {
    if (isResettingMode) return;
    isResettingMode = true;
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
        isActive: false,
        reverseStep: 1
    };
    
    updateModeUI();
    isResettingMode = false;
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
            
	            // Insert in both landscape and portrait containers for cross-device compatibility
	            const landscapeDiv = document.querySelector('.landscapemode .w3-container.w3-center');
	            const portraitDiv = document.querySelector('.portraitmode .w3-container.w3-center');
	            if (landscapeDiv) landscapeDiv.appendChild(timerDiv);
	            if (portraitDiv) {
	                const clone = timerDiv.cloneNode(true);
	                clone.id = 'mode-timer-portrait';
	                portraitDiv.appendChild(clone);
	            }
        }
        
	        const displays = document.querySelectorAll('[id$="timer-display"]');
	        displays.forEach(display => {
	            display.textContent = formatTime(modeState.timeRemaining);
	        });
	        // Also handle the case where the ID is exactly 'timer-display'
	        const mainDisplay = document.getElementById('timer-display');
	        if (mainDisplay) mainDisplay.textContent = formatTime(modeState.timeRemaining);
        
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
            
	            // Insert in both landscape and portrait containers
	            const landscapeDiv = document.querySelector('.landscapemode .w3-container.w3-center');
	            const portraitDiv = document.querySelector('.portraitmode .w3-container.w3-center');
	            if (landscapeDiv) landscapeDiv.appendChild(livesDiv);
	            if (portraitDiv) {
	                const clone = livesDiv.cloneNode(true);
	                clone.id = 'mode-lives-portrait';
	                portraitDiv.appendChild(clone);
	            }
        }
        
	        const displays = document.querySelectorAll('[id$="lives-display"]');
	        displays.forEach(display => {
	            display.textContent = '❤️'.repeat(modeState.livesRemaining);
	        });
	        const mainDisplay = document.getElementById('lives-display');
	        if (mainDisplay) mainDisplay.textContent = '❤️'.repeat(modeState.livesRemaining);
        
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
            
	            // Insert in both landscape and portrait containers
	            const landscapeDiv = document.querySelector('.landscapemode .w3-container.w3-center');
	            const portraitDiv = document.querySelector('.portraitmode .w3-container.w3-center');
	            if (landscapeDiv) landscapeDiv.appendChild(hintsDiv);
	            if (portraitDiv) {
	                const clone = hintsDiv.cloneNode(true);
	                clone.id = 'mode-hints-portrait';
	                portraitDiv.appendChild(clone);
	            }
        }
        
	        const displays = document.querySelectorAll('[id$="hints-display"]');
	        displays.forEach(display => {
	            display.textContent = '💡'.repeat(modeState.hintsRemaining);
	        });
	        const mainDisplay = document.getElementById('hints-display');
	        if (mainDisplay) mainDisplay.textContent = '💡'.repeat(modeState.hintsRemaining);
        
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
            
	            // Insert in both landscape and portrait containers
	            const landscapeDiv = document.querySelector('.landscapemode .w3-container.w3-center');
	            const portraitDiv = document.querySelector('.portraitmode .w3-container.w3-center');
	            if (landscapeDiv) landscapeDiv.appendChild(levelDiv);
	            if (portraitDiv) {
	                const clone = levelDiv.cloneNode(true);
	                clone.id = 'mode-level-portrait';
	                portraitDiv.appendChild(clone);
	            }
        }
        
	        const displays = document.querySelectorAll('[id$="level-display"]');
	        displays.forEach(display => {
	            display.textContent = `${modeState.currentLevel} (${modeState.levelProgress}/${config.puzzlesPerLevel})`;
	        });
	        const mainDisplay = document.getElementById('level-display');
	        if (mainDisplay) mainDisplay.textContent = `${modeState.currentLevel} (${modeState.levelProgress}/${config.puzzlesPerLevel})`;
        
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

    // Toggle visibility for both main and portrait cloned elements
    const elements = [
        { id: 'mode-timer', has: config.hasTimer },
        { id: 'mode-lives', has: config.hasLives },
        { id: 'mode-hints', has: config.hasHints },
        { id: 'mode-level', has: config.hasLevels }
    ];

    elements.forEach(el => {
        const main = document.getElementById(el.id);
        const portrait = document.getElementById(el.id + '-portrait');
        const display = el.has ? 'block' : 'none';
        if (main) main.style.display = display;
        if (portrait) portrait.style.display = display;
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
 * Handle time up even
(Content truncated due to size limit. Use line ranges to read remaining content)
