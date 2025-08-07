// chess-pgn-trainer.js

let board = null;
let game = new Chess();
let pgnMoves = [];
let currentMoveIndex = 0;
let currentPGNIndex = 0;
let currentMode = "standard";
let currentSetStartIndex = 0;
let setSize = 20;
let timer = null;
let timeLimitSeconds = 10;
let correctInSet = 0;
let totalInSet = 0;
let puzzles = [];

function resetBoard() {
  game.reset();
  board.position(game.fen());
}

function updateProgressBar() {
  const progress = (correctInSet / setSize) * 100;
  document.getElementById("progressBar").style.width = progress + "%";
}

function startRepetitionMode() {
  currentMode = "repetition";
  currentSetStartIndex = 0;
  correctInSet = 0;
  totalInSet = 0;
  updateProgressBar();
  loadNextSet();
}

function startStandardMode() {
  currentMode = "standard";
  currentPGNIndex = 0;
  loadPuzzle(0);
}

function loadPGNFile() {
  resetBoard();
  const selectedFile = document.getElementById("openPGN").value;

  if (selectedFile) {
    fetch(selectedFile)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load PGN file");
        }
        return response.text();
      })
      .then((pgnText) => {
        puzzles = pgnText.split(/\r?\n\r?\n/).filter((p) => p.trim() !== "");
        shuffleArray(puzzles);
        if (currentMode === "repetition") {
          startRepetitionMode();
        } else {
          startStandardMode();
        }
      })
      .catch((error) => console.error("Error loading PGN:", error));
  }
}

function loadNextSet() {
  correctInSet = 0;
  totalInSet = 0;
  updateProgressBar();
  loadPuzzle(currentSetStartIndex);
}

function loadPuzzle(index) {
  if (index >= puzzles.length) {
    alert("You've completed all puzzles!");
    return;
  }

  game.load_pgn(puzzles[index]);
  board.position(game.fen());
  pgnMoves = game.history();
  currentMoveIndex = 0;
  game.reset();
  board.position(game.fen());
  startTimer();
}

function startTimer() {
  clearTimer();
  timer = setTimeout(() => {
    if (currentMode === "repetition") {
      onMistakeInRepetition();
    }
  }, timeLimitSeconds * 1000);
}

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function onCorrectMoveInRepetition() {
  correctInSet++;
  totalInSet++;
  updateProgressBar();

  if (correctInSet >= setSize) {
    currentSetStartIndex += setSize;
    if (currentSetStartIndex >= puzzles.length) {
      alert("🎉 You've completed all sets!");
    } else {
      alert("✅ Set complete. Moving to next set.");
      loadNextSet();
    }
  } else {
    currentSetStartIndex++;
    loadPuzzle(currentSetStartIndex);
  }
}

function onMistakeInRepetition() {
  alert("❌ Incorrect or timed out. Restarting set.");
  loadNextSet();
}

function handleMove(source, target) {
  clearTimer();

  const move = game.move({ from: source, to: target, promotion: "q" });
  if (!move) return "snapback";

  const expectedMove = pgnMoves[currentMoveIndex];
  if (!expectedMove) return;

  const lastMove = game.history().slice(-1)[0];
  if (lastMove === expectedMove) {
    currentMoveIndex++;
    board.position(game.fen());

    if (currentMoveIndex >= pgnMoves.length) {
      if (currentMode === "repetition") {
        onCorrectMoveInRepetition();
      } else {
        currentPGNIndex++;
        loadPuzzle(currentPGNIndex);
      }
    } else {
      startTimer();
    }
  } else {
    if (currentMode === "repetition") {
      onMistakeInRepetition();
    } else {
      alert("❌ Incorrect move. Try again.");
      game.undo();
      board.position(game.fen());
      startTimer();
    }
  }
}

function onSnapEnd() {
  board.position(game.fen());
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

const config = {
  draggable: true,
  position: "start",
  onDrop: handleMove,
  onSnapEnd: onSnapEnd,
};

board = Chessboard("board", config);
