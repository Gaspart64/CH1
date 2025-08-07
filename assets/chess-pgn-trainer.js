// Chess PGN Trainer with Repetition Mode, Progress Bar, and Timer

let board = null;
let game = new Chess();
let puzzles = [];
let currentIndex = 0;
let mode = 'standard';
let repetitionSet = [];
let repetitionSize = 5;
let timePerPuzzle = 30; // seconds
let timerInterval = null;
let timeLeft = timePerPuzzle;

function resetGame() {
	game.reset();
	board.position(game.fen());
}

function loadPGNFile() {
	resetGame();
	const selectedFile = document.getElementById('openPGN').value;
	if (selectedFile) {
		fetch(selectedFile)
			.then(response => {
				if (!response.ok) {
					throw new Error('Network response was not ok');
				}
				return response.text();
			})
			.then(text => {
				puzzles = text.trim().split(/\r?\n/).filter(line => line);
				if (mode === 'repetition') {
					generateRepetitionSet();
					currentIndex = 0;
				} else {
					currentIndex = 0;
				}
				loadPuzzle();
			})
			.catch(error => console.error('Error loading PGN file:', error));
	}
}

function generateRepetitionSet() {
	repetitionSet = [];
	const shuffled = [...puzzles].sort(() => 0.5 - Math.random());
	repetitionSet = shuffled.slice(0, repetitionSize);
}

function getCurrentSet() {
	return mode === 'repetition' ? repetitionSet : puzzles;
}

function loadPuzzle() {
	clearInterval(timerInterval);
	timeLeft = timePerPuzzle;
	updateCountdown();
	startTimer();

	const pgn = getCurrentSet()[currentIndex];
	game.load_pgn(pgn);
	board.position(game.fen());
	updateProgress();
}

function onDrop(source, target) {
	const move = game.move({ from: source, to: target, promotion: 'q' });
	if (move === null) return 'snapback';

	const expectedGame = new Chess();
	expectedGame.load_pgn(getCurrentSet()[currentIndex]);

	const expectedMoves = expectedGame.history();
	const actualMoves = game.history();

	if (expectedMoves.length > actualMoves.length) {
		const expectedNext = expectedMoves[actualMoves.length - 1];
		if (expectedNext !== move.san) {
			if (mode === 'repetition') {
				generateRepetitionSet();
				currentIndex = 0;
			} else {
				currentIndex = 0;
			}
			loadPuzzle();
			return;
		}
	} else {
		currentIndex++;
		if (currentIndex >= getCurrentSet().length) {
			alert("You've completed the set!");
			currentIndex = 0;
			if (mode === 'repetition') {
				generateRepetitionSet();
			}
		}
		loadPuzzle();
	}
}

function updateProgress() {
	const percent = ((currentIndex) / getCurrentSet().length) * 100;
	document.getElementById('visualProgress').style.width = percent + '%';
}

function startTimer() {
	timerInterval = setInterval(() => {
		timeLeft--;
		updateCountdown();
		if (timeLeft <= 0) {
			clearInterval(timerInterval);
			if (mode === 'repetition') {
				generateRepetitionSet();
				currentIndex = 0;
			} else {
				currentIndex = 0;
			}
			loadPuzzle();
		}
	}, 1000);
}

function updateCountdown() {
	document.getElementById('countdown').innerText = `Time left: ${timeLeft}s`;
}

function toggleDarkMode() {
	document.body.classList.toggle('darkmode');
	document.getElementById('controls').classList.toggle('darkmode-control');
}

function setMode(selectedMode) {
	mode = selectedMode;
	document.getElementById('standardButton').classList.remove('active');
	document.getElementById('repetitionButton').classList.remove('active');
	document.getElementById(selectedMode + 'Button').classList.add('active');

	if (mode === 'repetition') {
		generateRepetitionSet();
		currentIndex = 0;
	} else {
		currentIndex = 0;
	}
	loadPuzzle();
}

document.addEventListener('DOMContentLoaded', () => {
	board = Chessboard('board', {
		draggable: true,
		position: 'start',
		onDrop: onDrop
	});

	document.getElementById('darkModeToggle').addEventListener('change', toggleDarkMode);
	document.getElementById('standardButton').addEventListener('click', () => setMode('standard'));
	document.getElementById('repetitionButton').addEventListener('click', () => setMode('repetition'));
});
