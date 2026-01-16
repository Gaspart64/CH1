# Reverse Mode Implementation

## Overview

The **Reverse Mode** (Backward Solving) is a new game mode added to the Chess PGN Trainer that implements incremental learning through backward-solving puzzles.

## How It Works

Instead of solving a puzzle by playing all moves from the beginning, Reverse Mode teaches puzzles incrementally:

1. **Level 1**: User plays only the *final move* (checkmate or winning move)
2. **Level 2**: User plays the *last 2 moves*
3. **Level 3**: User plays the *last 3 moves*
4. **And so on...** until the user can solve from the very beginning

### Example
For a puzzle with moves: `1. Qxe4+ Nxe4 2. Bxf7#`

- **Level 1**: Board shows position after `1. Qxe4+ Nxe4` → User plays `2. Bxf7#`
- **Level 2**: Board shows initial position → User plays `1. Qxe4+` → Opponent plays `Nxe4` → User plays `2. Bxf7#`

## Benefits

1. **Progressive Learning**: Start simple and build complexity
2. **Pattern Recognition**: Learn how puzzles end before understanding the setup
3. **Confidence Building**: Success on early levels motivates continued practice
4. **Spaced Repetition**: Multiple solves of the same position reinforce memory

## File Structure

### New Files

- **assets/reverse-mode.js** - Core logic for reverse mode puzzle handling

### Modified Files

- **assets/game-modes.js** - Added REVERSE mode configuration
- **index.html** - Added script reference for reverse-mode.js

## API Functions

### `initializeReverseMode(currentPuzzle)`
Sets up reverse mode data for a puzzle, identifying which moves are user moves.

**Parameters:**
- `currentPuzzle` - Puzzle object with `moves` and `position` properties

**Returns:** Reverse mode data object with user move indices and level info

### `setupReverseLevel(currentPuzzle, reverseModeData, level)`
Prepares the board position for a specific reverse mode level.

**Parameters:**
- `currentPuzzle` - Current puzzle
- `reverseModeData` - Data from initializeReverseMode()
- `level` - 0-based level number

**Returns:** Game state with board position and move info

### `validateReverseMove(gameState, move, reverseModeData, levelState)`
Checks if the user's move is correct in reverse mode.

**Parameters:**
- `gameState` - Current chess.js game state
- `move` - User's move in algebraic notation
- `reverseModeData` - Puzzle reverse mode data
- `levelState` - Current level state

**Returns:** Validation result with `isCorrect` and `expectedMove`

### `applyOpponentMoves(gameState, reverseModeData, levelState)`
Automatically applies opponent's moves after user's correct move.

**Parameters:**
- `gameState` - Current chess.js game state
- `reverseModeData` - Puzzle reverse mode data
- `levelState` - Current level state

**Returns:** Array of opponent moves applied

### `isReversePuzzleComplete(reverseModeData, levelState)`
Checks if all levels of the puzzle are completed.

**Parameters:**
- `reverseModeData` - Puzzle reverse mode data
- `levelState` - Current level state

**Returns:** Boolean indicating completion

### `getReverseLevelInfo(reverseModeData, level)`
Gets display information for current level.

**Parameters:**
- `reverseModeData` - Puzzle reverse mode data
- `level` - Current level

**Returns:** Object with level info for UI display

### `completeReverseLevel(reverseModeData, level)`
Marks a level as completed.

### `getReverseLevelDots(reverseModeData)`
Gets visual representation of all level progress.

**Returns:** Array of level dot objects for UI display

## Integration with Chess PGN Trainer

The reverse mode is integrated as a game mode option alongside Standard, Repetition, Three, Haste, Countdown, Speedrun, and Infinity modes.

### To Use Reverse Mode:

1. Open a PGN file with puzzles
2. Select "Reverse Mode (Backward Solving)" from the Game Mode dropdown
3. Start solving puzzles level by level
4. Progress through levels until you can solve from the beginning

## Example PGN Format

Standard PGN format works with Reverse Mode:

```
[Event "Polgar, Z - 200 Mattkombinationen"]
[Site "?"]
[Date "????.??.??"]
[Round "?"]
[White "?"]
[Black "?"]
[Result "*"]
[SetUp "1"]
[FEN "r1bqk2r/pppn1ppp/5n2/2B5/2B1p3/2N5/PPP1Q1PP/R4RK1 w kq - 0 1"]
[PlyCount "3"]

1. Qxe4+ Nxe4 2. Bxf7# *
```

The same puzzle works in Reverse Mode automatically!

## Technical Details

### Move Notation Handling
- Automatically strips check (`+`) and mate (`#`) symbols for chess.js compatibility
- Handles both standard algebraic notation (e.g., `e4`) and long form (e.g., `e2e4`)

### Level Calculation
- User move indices are identified by checking whose turn it is during move application
- Levels are determined by counting user moves
- Level N requires user to play N moves correctly

### Progress Tracking
- Completed levels are tracked per puzzle
- localStorage support for persistence (when integrated into main trainer)

## Future Enhancements

1. **Performance Stats**: Track time per level, error rate
2. **Audio Feedback**: Notification sounds for correct/incorrect moves
3. **Settings**: Configurable difficulty (skip early levels, custom level count)
4. **Export**: Track reverse mode progress in CSV exports
5. **Spaced Repetition**: Suggest review times based on completion

## Known Limitations

1. Variations in PGN files are not handled (use main-line only, or split variations into separate entries)
2. Requires chess.js library for move validation
3. Complex positions with multiple piece sets may render slowly on older devices

## Testing

To test the reverse mode:

1. Load the Polgar 200 Mate Combinations PGN file
2. Select Reverse Mode from the dropdown
3. Complete Level 1 (play the final move)
4. Complete Level 2 (play the last 2 moves)
5. Verify that board position updates correctly for each level

## Support

For issues or suggestions, please open an issue on the repository or contact the developer.
