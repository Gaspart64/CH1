# Chess PGN Trainer — Extended Edition

A feature-rich chess puzzle trainer built on top of [Chess-PGN-Trainer](https://github.com/rodpolako/Chess-PGN-Trainer) by rodpolako. This fork extends the original with seven distinct training modes, a full spaced repetition system based on the SM-2 algorithm, click-to-move support, session persistence, and a modern SVG chessboard.

---

## Table of Contents

- [Overview](#overview)
- [What's New in This Fork](#whats-new-in-this-fork)
- [Getting Started](#getting-started)
- [Training Modes](#training-modes)
  - [Standard Mode](#standard-mode)
  - [Repetition Mode](#repetition-mode)
  - [Three Mode](#three-mode)
  - [Haste Mode](#haste-mode)
  - [Countdown Mode](#countdown-mode)
  - [Speedrun Mode](#speedrun-mode)
  - [Infinity Mode (Spaced Repetition)](#infinity-mode-spaced-repetition)
- [Core Features](#core-features)
  - [Click-to-Move](#click-to-move)
  - [Legal Move Hints](#legal-move-hints)
  - [Session Persistence](#session-persistence)
  - [Piece Themes](#piece-themes)
  - [Board Customisation](#board-customisation)
  - [Dark Mode](#dark-mode)
  - [PGN Options & Tags](#pgn-options--tags)
  - [Results & Statistics](#results--statistics)
- [Spaced Repetition System](#spaced-repetition-system)
  - [How It Works](#how-it-works)
  - [SM-2 Algorithm](#sm-2-algorithm)
  - [Within-Session Retry](#within-session-retry)
  - [Session Completion](#session-completion)
  - [Persistence](#persistence)
- [PGN File Format](#pgn-file-format)
- [Project Structure](#project-structure)
- [Technical Notes](#technical-notes)
- [Credits](#credits)

---

## Overview

Chess PGN Trainer lets you load your own PGN files — tactical puzzles, opening repertoire, endgame studies — and drill them with structured training modes designed to simulate real game pressure. Unlike database-driven puzzle sites, you control the content: load what you want to study, choose how you want to train, and let the spaced repetition system handle long-term scheduling.

**Live demo:** [https://gaspart64.github.io/CH1/](https://gaspart64.github.io/CH1/)

---

## What's New in This Fork

| Feature | Original | This Fork |
|---|---|---|
| Training modes | 1 (Standard) | 7 modes |
| Spaced repetition | ❌ | ✅ SM-2 algorithm |
| Click-to-move | ❌ | ✅ |
| Legal move dots | ❌ | ✅ |
| Chessboard library | chessboard.js | cm-chessboard (SVG) |
| Session resume | ✅ | ✅ (extended) |
| Bundled PGN files | ❌ | ✅ Chessimo + Morphy |
| Mobile touch input | Limited | Full native support |

---

## Getting Started

The app runs entirely in the browser with no build step required.

**Option 1 — Use the live site:**  
Visit [https://gaspart64.github.io/CH1/](https://gaspart64.github.io/CH1/)

**Option 2 — Run locally:**

```bash
git clone https://github.com/gaspart64/CH1.git
cd CH1
# Serve with any static file server, e.g.:
python -m http.server 8080
# Then open http://localhost:8080
```

> **Note:** The app must be served over HTTP — opening `index.html` directly as a `file://` URL will not work because PGN files are loaded via `fetch()`.

**Loading a puzzle set:**  
Use the dropdown to select one of the bundled PGN files, or click **Open PGN File** to load your own. The app remembers your last session and will offer to resume it on next visit.

---

## Training Modes

Select a mode from the **Game Mode** dropdown before starting a session. Changing mode mid-session will prompt for confirmation and reset the current run.

---

### Standard Mode

The baseline experience. Puzzles are presented sequentially from the loaded PGN file. No time pressure, no lives, no limits — just work through each position at your own pace.

**Best for:** Learning a new puzzle set for the first time, or casual practice.

---

### Repetition Mode

Puzzles are grouped into **levels of 20**. To advance to the next level, you must complete all 20 puzzles in the current level without any errors. A single mistake resets the level.

- Level counter and progress (`Level 2 (14/20)`) displayed in the sidebar
- Forces clean, error-free solving before moving on
- Builds the kind of pattern recognition that comes from repeated perfect execution

**Best for:** Drilling a puzzle set until it becomes automatic. Effective for opening repertoire where precision matters.

---

### Three Mode

**3 minutes. 3 lives. 3 hints.**

A balanced pressure mode combining a countdown timer, a limited life pool, and a small number of hints.

- Timer starts at **3:00** and counts down
- Each incorrect move costs one ❤️ life
- Each hint costs one 💡 hint token (hint button is hidden in all other modes except Standard)
- Session ends when time runs out OR all lives are lost, whichever comes first

**Best for:** A quick focused training session with a fixed time budget and a small safety net.

---

### Haste Mode

A dynamic timer that rewards correct play and punishes mistakes.

- Starts with **30 seconds** on the clock
- **+5 seconds** for every correct move
- **−10 seconds** for every incorrect move
- Session ends when the clock reaches zero

The timer can go negative if a wrong move is made with less than 10 seconds remaining — displayed with a minus sign. Consistently correct play can extend a session indefinitely; sloppy play ends it quickly.

**Best for:** High-intensity drilling where accuracy directly controls how long you survive. Particularly effective for well-known puzzle sets where you should be playing quickly and correctly.

---

### Countdown Mode

A fixed **10-minute** session. Solve as many puzzles as possible before time runs out. No lives, no hints — just speed and accuracy.

- Timer counts down from 10:00
- No penalty for mistakes beyond the time lost fumbling
- Total puzzles solved is reported at session end

**Best for:** Benchmarking your performance on a puzzle set over time. Run the same set in Countdown mode periodically to track improvement.

---

### Speedrun Mode

No time limit — the timer counts **up** from zero. Complete all puzzles in the set as fast as possible. Your total time is recorded in the end-of-session statistics.

- Elapsed time displayed during the run
- No lives, no hints
- Finishing the entire set is the goal

**Best for:** Personal record attempts on a familiar puzzle set. Comparing runs on the same set over weeks or months to measure long-term improvement.

---

### Infinity Mode (Spaced Repetition)

The most sophisticated mode. Rather than working through puzzles in fixed order, Infinity Mode uses the **SM-2 spaced repetition algorithm** to schedule each puzzle based on your performance history. Puzzles you struggle with appear more frequently; puzzles you know well are reviewed less often.

See the full [Spaced Repetition System](#spaced-repetition-system) section below for a detailed explanation.

**Best for:** Long-term retention of a puzzle set studied over days, weeks, or months.

---

## Core Features

### Click-to-Move

Powered by [cm-chessboard](https://github.com/shaack/cm-chessboard). Move pieces by clicking the piece then clicking the destination square, or by dragging. Both methods work identically on desktop and mobile.

### Legal Move Hints

When you click a piece, all legal destination squares are highlighted with grey dots, and the selected piece's square is outlined with a frame — the same visual language used by Lichess and Chess.com. Click away or press Escape to deselect.

### Session Persistence

Your progress is automatically saved to `localStorage` after every move. If you close the browser or navigate away mid-session, the app will offer to resume where you left off when you return. Resume state includes:

- Current puzzle number and mode
- Error count and elapsed time
- Game mode and its internal state (timer, lives, etc.)
- Spaced repetition card data (saved independently, always preserved)

### Piece Themes

Multiple piece sets are bundled under `img/chesspieces/`. Switch between them in **Settings → Piece Style**. The board uses SVG sprite rendering for crisp display at all screen sizes and resolutions.

### Board Customisation

The square colours are fully customisable via the colour picker in **Settings → Square Color**. Separate pickers for light and dark squares. Changes are saved to `localStorage` and restored on next visit. Click **Reset** in Settings to return to defaults.

### Dark Mode

Toggle dark mode from **Settings → Dark Mode**. The setting persists across sessions.

### PGN Options & Tags

Several options can be toggled per-session or encoded directly into PGN tags so they activate automatically when a file is loaded:

| Option | Checkbox | PGN Tag |
|---|---|---|
| Play both sides | ✅ | `[PGNTrainerBothSides "1"]` |
| Play opposite side | ✅ | `[PGNTrainerOppositeSide "1"]` |
| Randomise puzzle order | ✅ | `[PGNTrainerRandomize "1"]` |
| Flip board | ✅ | `[PGNTrainerFlipped "1"]` |
| Show Lichess analysis link | ✅ | `[PGNTrainerAnalysisLink "1"]` |

**Play both sides** — you make every move for both colours.  
**Play opposite side** — you play the side that *doesn't* have the first move (useful for drilling defensive patterns).  
**Randomise** — shuffles puzzle order at session start.  
**Flipped** — mirrors the board orientation.  
**Analysis link** — displays a link below the board name to open the current position in Lichess's analysis board.

### Results & Statistics

At the end of a session the app displays:

- Total puzzles completed
- Number of errors and error rate (%)
- Total elapsed time (hh:mm:ss)
- Average time per puzzle
- A CSV-formatted results block for copying to a spreadsheet

**Auto-copy to clipboard** — if enabled in Settings, results are automatically copied when the session ends.  
**CSV headers** — optionally include a header row in the CSV output.

---

## Spaced Repetition System

### How It Works

Infinity Mode maintains a **card** for each puzzle in the loaded PGN. A card records:

- `repetitions` — how many times the puzzle has been solved cleanly
- `interval` — current review interval in days
- `easeFactor` — SM-2 ease factor (starts at 2.5, minimum 1.3)
- `nextReview` — timestamp (ms) when the puzzle is next due

At the start of each Infinity Mode session, puzzles are sorted into a queue:

1. **New cards** (never seen) — appear first
2. **Overdue cards** (due date in the past) — sorted by how overdue they are, most overdue first
3. **Future cards** (not yet due) — appended in due-date order

Only new and overdue cards are shown in a session. Once all due puzzles have been solved cleanly, the session ends and a completion screen is shown with session stats.

### SM-2 Algorithm

On each puzzle completion the SM-2 formula is applied:

```
easeFactor = max(1.3, easeFactor + 0.1 − (5 − quality) × (0.08 + (5 − quality) × 0.02))
```

Where `quality` is:
- **4** — solved correctly on the first attempt (no errors, no hints)
- **1** — solved after one or more retries within the session

Next review interval:
- `repetitions === 0` → 1 day
- `repetitions === 1` → 6 days
- `repetitions >= 2` → `round(interval × easeFactor)` days

Puzzles solved incorrectly (that fail to be cleaned up) are scheduled for **immediate review** (nextReview set to the past) so they appear first in the next session.

### Within-Session Retry

When you make an error on a puzzle, the puzzle is not shown again immediately. Instead it is **reinserted into the queue 4 positions ahead** of the current position. This means:

- You see 4 other puzzles before the failed one returns
- If you fail it again, it is reinserted another 4 positions ahead
- Only when you solve it cleanly is SM-2 applied (with a penalised quality score of 1)

This prevents the frustrating loop of failing the same puzzle repeatedly back-to-back, while still ensuring you clean it up before the session ends.

### Session Completion

The session ends when:
1. There are no more puzzles in `srPendingRetry` (all failed puzzles have been cleaned up), **and**
2. No cards remain that are new or overdue

At that point a completion screen is shown. Puzzles you solved cleanly are now scheduled days or weeks into the future; the app will present them again at the right time.

### Persistence

SR card data is saved to `localStorage` keyed by PGN filename. This means:
- Card data persists across browser sessions
- Different PGN files maintain independent SR histories
- Clearing the app settings does **not** clear SR data (it uses a separate key prefix)

---

## PGN File Format

Standard PGN with optional custom tags. Each game in the file represents one puzzle. The `FEN` tag is required if the puzzle does not start from the initial position.

```pgn
[Event "Tactics Unit 1, Exercise 3"]
[Site ""]
[Date "????.??.??"]
[White ""]
[Black ""]
[Result "1-0"]
[SetUp "1"]
[FEN "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4"]
[PGNTrainerBothSides "0"]
[PGNTrainerRandomize "0"]

1. Bxf7+ Kxf7 2. Ng5+ Ke8 3. Qf3 1-0
```

Tags used by the trainer:

| Tag | Values | Effect |
|---|---|---|
| `FEN` | FEN string | Starting position (required for non-initial positions) |
| `PGNTrainerBothSides` | `0` / `1` | Auto-enable "Play both sides" |
| `PGNTrainerOppositeSide` | `0` / `1` | Auto-enable "Play opposite side" |
| `PGNTrainerRandomize` | `0` / `1` | Auto-enable randomise |
| `PGNTrainerFlipped` | `0` / `1` | Auto-enable flipped board |
| `PGNTrainerAnalysisLink` | `0` / `1` | Auto-enable Lichess analysis link |
| `Event` | string | Displayed as the puzzle name |
| `White` / `Black` | string | Displayed under the puzzle name if both are set and not `?` |

---

## Project Structure

```
Chess-PGN-Trainer/
├── index.html                  # Main application page
├── assets/
│   ├── app.js                  # ES module entry point (cm-chessboard bridge)
│   ├── chess-pgn-trainer.js    # Core application logic
│   ├── game-modes.js           # Training modes + spaced repetition
│   ├── storage.js              # localStorage save/resume helpers
│   ├── piece-list.js           # Piece theme definitions
│   ├── pagestyle.css           # Application styles
│   ├── w3.js                   # W3 CSS helper
│   ├── jquery.wheelcolorpicker.js
│   ├── wheelcolorpicker.css
│   └── cm-chessboard/          # cm-chessboard library (local copy)
│       ├── src/                # ES module source
│       └── assets/             # CSS + SVG piece sprites
├── img/
│   └── chesspieces/            # Piece theme images (PNG/SVG)
│       ├── staunty/
│       ├── alpha/
│       └── ...
└── PGN/
    ├── 1.pgn                   # Chessimo set 1
    ├── 2.pgn                   # Chessimo set 2
    ├── 3.pgn                   # Chessimo set 3
    ├── 4.pgn                   # Chessimo set 4
    ├── 5.pgn                   # Chessimo set 5
    └── MorphyWhite15.pgn       # Morphy as White (15 games)
```

---

## Technical Notes

**Chessboard library:** The original chessboard.js has been replaced with [cm-chessboard](https://github.com/shaack/cm-chessboard) v8. cm-chessboard is an ES module with native pointer event support, which enables reliable click-to-move and drag on both desktop and mobile. The board is SVG-based and auto-resizes without requiring explicit resize calls.

**ES module bridge:** Because cm-chessboard is an ES module and the existing app scripts are plain globals-based scripts, `assets/app.js` acts as a bridge: it imports cm-chessboard symbols and exposes them on `window`, then loads the remaining scripts sequentially before calling `initalize()`.

**Move input lifecycle:** cm-chessboard's move input must be explicitly enabled per puzzle (`board.enableMoveInput()`) and requires `board.disableMoveInput()` before re-enabling. The app manages this in `loadPuzzle()`. All game logic runs synchronously inside `validateMoveInput`; `loadPuzzle()` for the next puzzle is deferred via `setTimeout(0)` to let cm-chessboard finish processing the current move event before the board is reset.

**Spaced repetition storage:** SR card data is stored in `localStorage` under keys prefixed `sr_cards_` followed by the PGN filename. This keeps SR data isolated from other app settings and allows multiple PGN files to maintain independent histories.

**Browser requirements:** A modern browser with ES module support (Chrome 61+, Firefox 60+, Safari 11+, Edge 16+). The app works as a PWA and can be added to the home screen on mobile.

---

## Credits

- Original **Chess-PGN-Trainer** by [rodpolako](https://github.com/rodpolako/Chess-PGN-Trainer)
- Chessboard rendering by [cm-chessboard](https://github.com/shaack/cm-chessboard) by Stefan Haack
- Chess logic by [chess.js](https://github.com/jhlywa/chess.js)
- PGN parsing by [@mliebelt/pgn-parser](https://github.com/mliebelt/pgn-parser)
- UI framework by [W3.CSS](https://www.w3schools.com/w3css/)
- Spaced repetition based on the [SM-2 algorithm](https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-obtained-in-working-with-the-supermemo-method) by Piotr Woźniak
