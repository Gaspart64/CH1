// chess-pgn-trainer.js - Refactored for modular modes & stable chessboard

let board = null;
let game = new Chess();
let puzzles = [];
let mode = 'standard';
let currentIndex = 0;

// Timer refs for modes that need it
let timerInterval = null;
let timeLeft = 0;

// Elements cached
let progressBarElem = null;
let countdownElem = null;
let modeButtons = { standard: null, repetition: null };

function resetGame() {
	game.reset();
	board.position(game.fen());
}

function loadPGNFile() {
	const selectedFile = document.getElementById('openPGN').value;
	if (!selectedFile) {
		alert('Please select a PGN file');
		return;
	}

	fetch(selectedFile)
		.then(res => {
			if (!res.ok) throw new Error('Failed to load PGN file');
			return res.text();
		})
		.then(text => {
			puzzles = text.trim().split(/\r?\n/).filter(line => line);
			// Start current mode with new puzzles
			modeManagers[mode].start();
		})
		.catch(err => {
			console.error('Error loading PGN:', err);
			alert('Failed to load PGN file');
		});
}

// Mode Managers

const modeManagers = {

	standard: {
		start() {
			currentIndex = 0;
			this.stopTimer();
			this.loadCurrentPuzzle();
			updateProgressBar(0);
			updateCountdown('');
		},

		stop() {
			this.stopTimer();
		},

		loadCurrentPuzzle() {
			if (currentIndex >= puzzles.length) currentIndex = 0;
			const pgn = puzzles[currentIndex];
			game.load_pgn(pgn);
			board.position(game.fen());
		},

		onMove(move) {
			const expectedGame = new Chess();
			expectedGame.load_pgn(puzzles[currentIndex]);
			const expectedMoves = expectedGame.history();
			const actualMoves = game.history();

			if (expectedMoves.length > actualMoves.length) {
				const expectedNext = expectedMoves[actualMoves.length - 1];
				if (expectedNext !== move.san) {
					// Mistake, reset current puzzle
					alert('Wrong move, try again.');
					game.load_pgn(puzzles[currentIndex]);
					board.position(game.fen());
					return false; // snapback
				}
			}

			if (actualMoves.length === expectedMoves.length) {
				currentIndex++;
				if (currentIndex >= puzzles.length) {
					alert("You've completed all puzzles!");
					currentIndex = 0;
				}
				this.loadCurrentPuzzle();
				updateProgressBar((currentIndex / puzzles.length) * 100);
			}
			return true;
		},

		stopTimer() {
			if (timerInterval) {
				clearInterval(timerInterval);
				timerInterval = null;
			}
		}
	},

	repetition: {
		repetitionSet: [],
		repetitionSize: 5,
		timePerPuzzle: 10,
		timeLeft: 0,

		start() {
			this.generateRepetitionSet();
			currentIndex = 0;
			this.loadCurrentPuzzle();
			this.startTimer();
			updateProgressBar(0);
		},

		stop() {
			this.stopTimer();
		},

		generateRepetitionSet() {
			const shuffled = [...puzzles].sort(() => 0.5 - Math.random());
			this.repetitionSet = shuffled.slice(0, this.repetitionSize);
		},

		loadCurrentPuzzle() {
			if (currentIndex >= this.repetitionSet.length) currentIndex = 0;
			const pgn = this.repetitionSet[currentIndex];
			game.load_pgn(pgn);
			board.position(game.fen());
			this.timeLeft = this.timePerPuzzle;
			updateCountdown(`Time left: ${this.timeLeft}s`);
		},

		onMove(move) {
			const expectedGame = new Chess();
			expectedGame.load_pgn(this.repetitionSet[currentIndex]);
			const expectedMoves = expectedGame.history();
			const actualMoves = game.history();

			if (expectedMoves.length > actualMoves.length) {
				const expectedNext = expectedMoves[actualMoves.length - 1];
				if (expectedNext !== move.san) {
					alert('Mistake! Repeating the whole set.');
					this.generateRepetitionSet();
					currentIndex = 0;
					this.loadCurrentPuzzle();
					return false;
				}
			}

			if (actualMoves.length === expectedMoves.length) {
				currentIndex++;
				if (currentIndex >= this.repetitionSet.length) {
					alert("You've completed the repetition set!");
					this.generateRepetitionSet();
					currentIndex = 0;
				}
				this.loadCurrentPuzzle();
				updateProgressBar((currentIndex / this.repetitionSet.length) * 100);
			}
			return true;
		},

		startTimer() {
			this.stopTimer();
			timerInterval = setInterval(() => {
				this.timeLeft--;
				updateCountdown(`Time left: ${this.timeLeft}s`);
				if (this.timeLeft <= 0) {
					this.stopTimer();
					alert('Time expired! Repeating the whole set.');
					this.generateRepetitionSet();
					currentIndex = 0;
					this.loadCurrentPuzzle();
					updateProgressBar(0);
				}
			}, 1000);
		},

		stopTimer() {
			if (timerInterval) {
				clearInterval(timerInterval);
				timerInterval = null;
			}
		}
	}
};

function onDrop(source, target) {
	const move = game.move({ from: source, to: target, promotion: 'q' });
	if (move === null) return 'snapback';

	const validMove = modeManagers[mode].onMove(move);
	if (!validMove) return 'snapback';

	return undefined;
}

function updateProgressBar(percent) {
	if (!progressBarElem) return;
	progressBarElem.style.width = percent + '%';
}

function updateCountdown(text) {
	if (!countdownElem) return;
	countdownElem.innerText = text;
}

function setMode(selectedMode) {
	if (!modeManagers[selectedMode]) {
		console.warn('Unknown mode:', selectedMode);
		return;
	}
	// Stop old mode
	modeManagers[mode].stop();
	mode = selectedMode;

	// Update button states
	Object.entries(modeButtons).forEach(([key, btn]) => {
		if (!btn) return;
		if (key === selectedMode) btn.classList.add('active');
		else btn.classList.remove('active');
	});

	// Start new mode
	modeManagers[mode].start();
}

function toggleDarkMode() {
	document.body.classList.toggle('darkmode');
	document.getElementById('controls').classList.toggle('darkmode-control');
}

document.addEventListener('DOMContentLoaded', () => {
	// Cache UI elems
	progressBarElem = document.getElementById('visualProgress');
	countdownElem = document.getElementById('countdown');
	modeButtons.standard = document.getElementById('standardButton');
	modeButtons.repetition = document.getElementById('repetitionButton');

	board = Chessboard('board', {
		draggable: true,
		position: 'start',
		onDrop: onDrop
	});

	document.getElementById('darkModeToggle').addEventListener('change', toggleDarkMode);
	modeButtons.standard.addEventListener('click', () => setMode('standard'));
	modeButtons.repetition.addEventListener('click', () => setMode('repetition'));

	// Load PGN file on page load or leave empty
	// You may trigger loadPGNFile() manually after file selection

	setMode('standard');
});
