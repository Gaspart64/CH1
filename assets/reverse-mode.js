/*
 * Reverse Mode Module for Chess PGN Trainer
 * Implements backward-solving puzzle training (start with final move, work backwards)
 */

/**
 * Initialize reverse mode for current puzzle
 * @param {Object} currentPuzzle - The current puzzle object
 * @returns {Object} Reverse mode configuration for this puzzle
 */
function initializeReverseMode(currentPuzzle) {
    const reverseModeData = {
        originalMoves: currentPuzzle.moves || [],
        userMoveIndices: [],
        winningSide: null,
        currentLevel: 0,
        maxLevel: 0,
        completedLevels: [],
        puzzleGameState: null
    };

    if (reverseModeData.originalMoves.length === 0) {
        return reverseModeData;
    }

    // Determine which moves are played by the starting side
    const tempGame = new Chess(currentPuzzle.position || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    reverseModeData.winningSide = tempGame.turn();

    // Find indices of moves played by the winning side
    for (let i = 0; i < reverseModeData.originalMoves.length; i++) {
        const moveResult = tempGame.move(reverseModeData.originalMoves[i]);
        if (!moveResult) {
            console.error(`Failed to apply move: ${reverseModeData.originalMoves[i]} at index ${i}`);
            continue;
        }
        
        // Check if this was the winning side's move (before the move was applied)
        if (i === 0 || reverseModeData.winningSide === tempGame.turn()) {
            reverseModeData.userMoveIndices.push(i);
        }
    }

    reverseModeData.maxLevel = reverseModeData.userMoveIndices.length;

    return reverseModeData;
}

/**
 * Set up the board position for the current reverse mode level
 * @param {Object} currentPuzzle - The current puzzle
 * @param {Object} reverseModeData - The reverse mode data
 * @param {number} level - The current level (0-based)
 * @returns {Object} Game state with board position
 */
function setupReverseLevel(currentPuzzle, reverseModeData, level) {
    const gameState = new Chess(currentPuzzle.position || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    
    // Determine how many moves the user needs to play at this level
    const userMovesNeeded = level + 1;
    const userMovesTotal = reverseModeData.userMoveIndices.length;
    const startMoveIndex = userMovesTotal - userMovesNeeded;

    // Find the first user move at this level
    const firstUserMoveInSolution = reverseModeData.userMoveIndices[startMoveIndex];

    // Apply all setup moves (those before the user's first move at this level)
    if (firstUserMoveInSolution !== undefined) {
        for (let i = 0; i < firstUserMoveInSolution; i++) {
            const moveResult = gameState.move(reverseModeData.originalMoves[i]);
            if (!moveResult) {
                console.error(`Failed to apply setup move: ${reverseModeData.originalMoves[i]} at index ${i}`);
            }
        }
    }

    return {
        game: gameState,
        currentUserMoveIndex: startMoveIndex,
        userMovesInLevel: 0,
        userMovesNeeded: userMovesNeeded,
        firstUserMoveIndex: firstUserMoveInSolution
    };
}

/**
 * Validate a move in reverse mode
 * @param {Object} gameState - Current chess.js game state
 * @param {string} move - The move notation
 * @param {Object} reverseModeData - The reverse mode data
 * @param {Object} levelState - Current level state
 * @returns {Object} Validation result {isCorrect, expectedMove, nextMoveIndex}
 */
function validateReverseMove(gameState, move, reverseModeData, levelState) {
    const userMoveIndices = reverseModeData.userMoveIndices;
    const originalMoves = reverseModeData.originalMoves;
    const currentUserMoveIndex = levelState.currentUserMoveIndex;

    if (currentUserMoveIndex >= userMoveIndices.length) {
        return {
            isCorrect: false,
            reason: 'No more moves expected'
        };
    }

    const targetMoveAbsoluteIndex = userMoveIndices[currentUserMoveIndex];
    const expectedMove = originalMoves[targetMoveAbsoluteIndex];

    // Normalize move notation (remove check/mate symbols)
    const normalizedMove = move.replace(/[\+#]$/, '');
    const normalizedExpected = expectedMove.replace(/[\+#]$/, '');

    const isCorrect = normalizedMove === normalizedExpected;

    return {
        isCorrect,
        expectedMove: normalizedExpected,
        moveIndex: targetMoveAbsoluteIndex,
        nextMoveIndex: currentUserMoveIndex + 1
    };
}

/**
 * Apply opponent moves after user's correct move
 * @param {Object} gameState - Current chess.js game state
 * @param {Object} reverseModeData - The reverse mode data
 * @param {Object} levelState - Current level state
 * @returns {Array} Array of opponent moves that were applied
 */
function applyOpponentMoves(gameState, reverseModeData, levelState) {
    const userMoveIndices = reverseModeData.userMoveIndices;
    const originalMoves = reverseModeData.originalMoves;
    const currentUserMoveIndex = levelState.nextMoveIndex;
    const userMovesNeeded = levelState.userMovesNeeded;

    if (currentUserMoveIndex >= userMoveIndices.length) {
        // All user moves completed
        return [];
    }

    const appliedMoves = [];
    const nextUserMoveIndex = userMoveIndices[currentUserMoveIndex];

    // Apply moves between current user move and next user move
    const lastUserMoveIndex = userMoveIndices[currentUserMoveIndex - 1];
    for (let i = lastUserMoveIndex + 1; i < nextUserMoveIndex; i++) {
        const moveResult = gameState.move(originalMoves[i]);
        if (moveResult) {
            appliedMoves.push(originalMoves[i]);
        }
    }

    return appliedMoves;
}

/**
 * Check if puzzle is completed in reverse mode
 * @param {Object} reverseModeData - The reverse mode data
 * @param {Object} levelState - Current level state
 * @returns {boolean} True if all user moves have been made correctly
 */
function isReversePuzzleComplete(reverseModeData, levelState) {
    return levelState.nextMoveIndex >= reverseModeData.userMoveIndices.length;
}

/**
 * Get level display info for reverse mode
 * @param {Object} reverseModeData - The reverse mode data
 * @param {number} level - Current level
 * @returns {Object} Display info {currentLevel, maxLevel, movesRemaining}
 */
function getReverseLevelInfo(reverseModeData, level) {
    const movesRemaining = (level + 1);
    
    return {
        currentLevel: level + 1,
        maxLevel: reverseModeData.maxLevel,
        movesRemaining: movesRemaining,
        completedLevels: reverseModeData.completedLevels
    };
}

/**
 * Mark reverse mode level as completed
 * @param {Object} reverseModeData - The reverse mode data
 * @param {number} level - The completed level
 */
function completeReverseLevel(reverseModeData, level) {
    if (!reverseModeData.completedLevels.includes(level)) {
        reverseModeData.completedLevels.push(level);
    }
}

/**
 * Get visual representation of level progress (dots)
 * @param {Object} reverseModeData - The reverse mode data
 * @returns {Array} Array of level states {levelNum, completed, current}
 */
function getReverseLevelDots(reverseModeData) {
    const dots = [];
    
    for (let i = 0; i < reverseModeData.maxLevel; i++) {
        dots.push({
            levelNum: i + 1,
            completed: reverseModeData.completedLevels.includes(i),
            current: false // Will be set by calling code
        });
    }
    
    return dots;
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeReverseMode,
        setupReverseLevel,
        validateReverseMove,
        applyOpponentMoves,
        isReversePuzzleComplete,
        getReverseLevelInfo,
        completeReverseLevel,
        getReverseLevelDots
    };
}
