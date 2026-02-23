/**
 * app.js — ES Module entry point for Chess PGN Trainer
 *
 * cm-chessboard is an ES module and cannot be loaded with a plain <script> tag.
 * This file imports it and re-exports the symbols the app needs as globals,
 * then dynamically loads the remaining non-module app scripts in order.
 *
 * Why globals instead of proper imports?
 * The existing app scripts (storage.js, game-modes.js, chess-pgn-trainer.js,
 * piece-list.js) are plain scripts that share a global scope. Refactoring them
 * all to ES modules is a larger project. This bridge approach lets us adopt
 * cm-chessboard now without rewriting everything.
 */

import {
    Chessboard,
    COLOR,
    FEN,
    INPUT_EVENT_TYPE,
    MARKER_TYPE
} from './cm-chessboard/src/Chessboard.js';

import { Markers } from './cm-chessboard/src/extensions/markers/Markers.js';

import {
    PromotionDialog,
    PROMOTION_DIALOG_RESULT_TYPE
} from './cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js';

// ── Expose cm-chessboard symbols as globals ──────────────────────────────────
// chess-pgn-trainer.js references these by name without importing them.
window.Chessboard                  = Chessboard;
window.COLOR                       = COLOR;
window.FEN                         = FEN;
window.INPUT_EVENT_TYPE            = INPUT_EVENT_TYPE;
window.MARKER_TYPE                 = MARKER_TYPE;
window.Markers                     = Markers;
window.PromotionDialog             = PromotionDialog;
window.PROMOTION_DIALOG_RESULT_TYPE = PROMOTION_DIALOG_RESULT_TYPE;

// ── Load remaining app scripts in the correct order ───────────────────────────
// Each script is loaded sequentially so globals are available to later scripts.
async function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload  = resolve;
        s.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(s);
    });
}

(async () => {
    try {
        await loadScript('./assets/storage.js');
        await loadScript('./assets/game-modes.js');
        await loadScript('./assets/chess-pgn-trainer.js');
        await loadScript('./assets/piece-list.js');
    } catch (err) {
        console.error('App failed to load:', err);
    }
})();
