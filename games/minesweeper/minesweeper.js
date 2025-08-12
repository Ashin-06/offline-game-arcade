const boardElement = document.getElementById('board');
const newGameButton = document.getElementById('newGameButton');
const rowsInput = document.getElementById('rowsInput');
const colsInput = document.getElementById('colsInput');
const minesInput = document.getElementById('minesInput');
const resultMessage = document.getElementById('result-message');

let board = [];
let gameOver = false;
let revealedTiles = 0;
let totalTiles = 0;

function initializeGame() {
    // Read settings from input fields
    const ROWS = parseInt(rowsInput.value);
    const COLS = parseInt(colsInput.value);
    const MINES_COUNT = parseInt(minesInput.value);

    // Validation
    if (MINES_COUNT >= ROWS * COLS) {
        alert("Mine count must be less than the total number of cells.");
        return;
    }

    gameOver = false;
    revealedTiles = 0;
    totalTiles = ROWS * COLS;
    boardElement.innerHTML = '';
    resultMessage.classList.add('hidden');
    board = [];
    boardElement.style.width = `${COLS * 32}px`;

    // Create board data structure
    for (let r = 0; r < ROWS; r++) {
        let row = [];
        for (let c = 0; c < COLS; c++) {
            row.push({
                isMine: false, isRevealed: false, isFlagged: false, adjacentMines: 0
            });
        }
        board.push(row);
    }
    
    placeMines(ROWS, COLS, MINES_COUNT);
    calculateAdjacentMines(ROWS, COLS);
    renderBoard(ROWS, COLS);
}

function renderBoard(ROWS, COLS) {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const tileDiv = document.createElement('div');
            tileDiv.classList.add('tile');
            tileDiv.dataset.row = r;
            tileDiv.dataset.col = c;
            tileDiv.addEventListener('click', handleTileClick);
            tileDiv.addEventListener('contextmenu', handleRightClick);
            boardElement.appendChild(tileDiv);
            board[r][c].element = tileDiv;
        }
    }
}

function placeMines(ROWS, COLS, MINES_COUNT) {
    let minesPlaced = 0;
    while (minesPlaced < MINES_COUNT) {
        const r = Math.floor(Math.random() * ROWS);
        const c = Math.floor(Math.random() * COLS);
        if (!board[r][c].isMine) {
            board[r][c].isMine = true;
            minesPlaced++;
        }
    }
}

function calculateAdjacentMines(ROWS, COLS) {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c].isMine) continue;
            let count = 0;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc].isMine) {
                        count++;
                    }
                }
            }
            board[r][c].adjacentMines = count;
        }
    }
}

function handleTileClick(event) {
    if (gameOver) return;
    const tileDiv = event.target;
    const r = parseInt(tileDiv.dataset.row);
    const c = parseInt(tileDiv.dataset.col);
    const tile = board[r][c];

    if (tile.isRevealed || tile.isFlagged) return;

    if (tile.isMine) {
        endGame(false); // Player lost
        return;
    }

    revealTile(r, c);
    checkWinCondition();
}

function revealTile(r, c) {
    const tile = board[r][c];
    if (tile.isRevealed || tile.isFlagged) return;

    tile.isRevealed = true;
    revealedTiles++;
    tile.element.classList.add('tile-clicked');

    if (tile.adjacentMines > 0) {
        tile.element.textContent = tile.adjacentMines;
        tile.element.classList.add('c' + tile.adjacentMines);
    } else {
        // Flood fill for empty tiles
        const ROWS = board.length;
        const COLS = board[0].length;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                    revealTile(nr, nc);
                }
            }
        }
    }
}

function handleRightClick(event) {
    event.preventDefault();
    if (gameOver) return;
    const tileDiv = event.target;
    const r = parseInt(tileDiv.dataset.row);
    const c = parseInt(tileDiv.dataset.col);
    const tile = board[r][c];

    if (tile.isRevealed) return;
    tile.isFlagged = !tile.isFlagged;
    tile.element.textContent = tile.isFlagged ? '🚩' : '';
}

function checkWinCondition() {
    const MINES_COUNT = parseInt(minesInput.value);
    if (revealedTiles === totalTiles - MINES_COUNT) {
        endGame(true); // Player won
    }
}

function endGame(isWin) {
    gameOver = true;
    revealAllMines();
    resultMessage.textContent = isWin ? "You Win!" : "Game Over!";
    resultMessage.classList.remove('hidden');
}

function revealAllMines() {
    for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[0].length; c++) {
            const tile = board[r][c];
            if (tile.isMine) {
                tile.element.classList.add('tile-clicked');
                tile.element.textContent = '💣';
            }
        }
    }
}

newGameButton.addEventListener('click', initializeGame);
initializeGame();