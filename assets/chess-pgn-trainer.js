// chess-pgn-trainer.js (Combined Full File with Repetition Mode and Timer)

let board = null;
let game = new Chess();
let pgnMoves = [];
let currentMoveIndex = 0;
let currentMode = "standard";
let timer = null;
let timePerPuzzle = 10000; // 10 seconds

// Repetition mode settings
const repetitionSetSize = 20;
let currentSetStartIndex = loadProgress();
let currentSetProgress = 0;
let repetitionActive = false;

// UI Elements
const progressBar = document.getElementById("progressBar");

function resetGame() {
  game.reset();
  currentMoveIndex = 0;
  board.position(game.fen());
  clearTimeout(timer);
}

function loadPGNFile() {
  resetGame();
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
        pgnMoves = parsePGNMoves(pgnText);
        if (currentMode === "repetition") {
          startRepetitionSet();
        } else {
          loadNextPuzzle();
        }
      });
  }
}

function parsePGNMoves(pgnText) {
  const regex = /\d+\.(?:\s*[^\s]+\s+([^\s]+))?/g;
  const matches = [...pgnText.matchAll(/\d+\.\s*([^\s]+)(?:\s+([^\s]+))?/g)];
  const moves = [];
  for (const match of matches) {
    if (match[1]) moves.push(match[1]);
    if (match[2]) moves.push(match[2]);
  }
  return moves;
}

function onDrop(source, target) {
  const move = game.move({ from: source, to: target, promotion: "q" });
  if (move === null) return "snapback";

  board.position(game.fen());

  if (currentMode === "repetition") {
    const correctMove = pgnMoves[currentSetStartIndex + currentSetProgress];
    if (move.san === correctMove) {
      onCorrectMoveInRepetition();
    } else {
      onMistakeInRepetition();
    }
  } else {
    if (move.san === pgnMoves[currentMoveIndex]) {
      currentMoveIndex++;
      if (currentMoveIndex >= pgnMoves.length) {
        alert("End of puzzles");
      } else {
        resetGame();
      }
    } else {
      alert("Incorrect move, try again");
      game.undo();
      board.position(game.fen());
    }
  }
}

function startRepetitionMode() {
  currentMode = "repetition";
  currentSetStartIndex = loadProgress();
  currentSetProgress = 0;
  repetitionActive = true;
  loadPGNFile();
}

function startRepetitionSet() {
  resetGame();
  const move = pgnMoves[currentSetStartIndex + currentSetProgress];
  if (!move) {
    alert("No more puzzles");
    return;
  }
  startTimer();
}

function startTimer() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    alert("Time's up!");
    onMistakeInRepetition();
  }, timePerPuzzle);
}

function updateProgressBar() {
  const percent = Math.floor((currentSetProgress / repetitionSetSize) * 100);
  progressBar.style.width = percent + "%";
}

function onCorrectMoveInRepetition() {
  currentSetProgress++;
  updateProgressBar();

  if (currentSetProgress >= repetitionSetSize) {
    currentSetStartIndex += repetitionSetSize;
    saveProgress(currentSetStartIndex);
    alert("Set complete! Moving to next set.");
    currentSetProgress = 0;
    startRepetitionSet();
  } else {
    resetGame();
    startRepetitionSet();
  }
}

function onMistakeInRepetition() {
  alert("Mistake or timeout! Restarting set.");
  currentSetProgress = 0;
  updateProgressBar();
  resetGame();
  startRepetitionSet();
}

// Save/load helpers
function saveProgress(setIndex) {
  localStorage.setItem("repetitionSetIndex", setIndex.toString());
}

function loadProgress() {
  const val = localStorage.getItem("repetitionSetIndex");
  return val ? parseInt(val) : 0;
}

// Init board
const config = {
  draggable: true,
  position: "start",
  onDrop: onDrop,
};

board = Chessboard("board", config);
