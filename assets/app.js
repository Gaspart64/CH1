/**
 * app.js — ES Module entry point for Chess PGN Trainer
 *
 * cm-chessboard is an ES module and cannot be loaded with a plain <script> tag.
 * This file imports it and re-exports the symbols the app needs as globals,
 * then dynamically loads the remaining non-module app scripts in order.
 */

import {
    Chessboard,
    COLOR,
    INPUT_EVENT_TYPE
} from './cm-chessboard/src/Chessboard.js';

import {
    Markers,
    MARKER_TYPE
} from './cm-chessboard/src/extensions/markers/Markers.js';

import {
    PromotionDialog,
    PROMOTION_DIALOG_RESULT_TYPE
} from './cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js';

// ── Expose cm-chessboard symbols as globals ──────────────────────────────────
window.Chessboard                   = Chessboard;
window.COLOR                        = COLOR;
window.INPUT_EVENT_TYPE             = INPUT_EVENT_TYPE;
window.MARKER_TYPE                  = MARKER_TYPE;
window.Markers                      = Markers;
window.PromotionDialog              = PromotionDialog;
window.PROMOTION_DIALOG_RESULT_TYPE = PROMOTION_DIALOG_RESULT_TYPE;
window.CM_ASSETS_URL                = './assets/cm-chessboard/assets/';

// ── Load remaining app scripts in the correct order ─────────────────────────
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

        // Scripts are now fully loaded — safe to initialise the app.
        // This replaces the body onload="initalize()" attribute which fires
        // before ES modules finish loading.
        if (typeof initalize === 'function') {
            initalize();
        }
    } catch (err) {
        console.error('App failed to load:', err);
    }
})();
