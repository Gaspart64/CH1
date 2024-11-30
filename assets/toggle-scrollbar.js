const ChessboardScrollControl = (() => {
  // Key codes for navigation and control
  const SCROLL_KEYS = {
    'ArrowLeft': 1, 'ArrowUp': 1, 'ArrowRight': 1, 'ArrowDown': 1,
    'PageUp': 1, 'PageDown': 1, 'End': 1, 'Home': 1, ' ': 1 // Spacebar
  };

  // Detect wheel event and passive support
  const WHEEL_EVENT = 'onwheel' in document.createElement('div') ? 'wheel' : 'mousewheel';
  const WHEEL_OPT = (() => {
    let supportsPassive = false;
    try {
      window.addEventListener("test", null, Object.defineProperty({}, 'passive', { get: () => supportsPassive = true }));
    } catch (e) {}
    return supportsPassive ? { passive: false } : false;
  })();

  // Prevent default behavior
  function preventDefault(e) {
    e.preventDefault();
  }

  // Prevent default behavior for scroll keys
  function preventDefaultForScrollKeys(e) {
    if (SCROLL_KEYS[e.key]) {
      preventDefault(e);
      return false;
    }
  }

  // Register event listeners
  function registerListeners(action) {
    const method = action === 'add' ? 'addEventListener' : 'removeEventListener';
    window[method]('DOMMouseScroll', preventDefault, false); // older FF
    window[method](WHEEL_EVENT, preventDefault, WHEEL_OPT); // modern desktop
    window[method]('touchmove', preventDefault, WHEEL_OPT); // mobile
    window[method]('keydown', preventDefaultForScrollKeys, false);
  }

  // Disable scrolling
  function disableScroll() {
    registerListeners('add');
  }

  // Enable scrolling
  function enableScroll() {
    registerListeners('remove');
  }

  // Public methods
  return {
    /**
     * Initialize scroll control for a chessboard
     * @param {Object} board - Chessboard instance
     */
    init: function(board) {
      if (!board) {
        console.error('Chessboard instance is required');
        return null;
      }

      const boardElement = board.containerEl;
      if (!boardElement) {
        console.error('Could not find chessboard container');
        return null;
      }

      // Track whether scroll is currently disabled
      let isScrollDisabled = false;

      // Disable scrolling
      const disableScroll = () => {
        if (!isScrollDisabled) {
          registerListeners('add');
          isScrollDisabled = true;
        }
      };

      // Enable scrolling
      const enableScroll = () => {
        if (isScrollDisabled) {
          registerListeners('remove');
          isScrollDisabled = false;
        }
      };

      // Add event listeners for piece dragging
      boardElement.addEventListener('mousedown', (e) => {
        // Check if the event target is within a chess piece
        const isPieceDragging = e.target.classList.contains('piece') || 
                                 e.target.closest('.piece');
        if (isPieceDragging) {
          disableScroll();
        }
      });

      // Re-enable scrolling when mouse is released
      document.addEventListener('mouseup', enableScroll);

      // Methods to manually control scroll during specific board states
      return {
        disableScroll,
        enableScroll,
        
        /**
         * Reset scroll state when game starts or is cleared
         */
        resetScroll: function() {
          enableScroll();
        }
      };
    },
    // Expose these methods globally
    disableScroll,
    enableScroll
  };
})();

// Make the entire object globally accessible
window.ChessboardScrollControl = ChessboardScrollControl;
