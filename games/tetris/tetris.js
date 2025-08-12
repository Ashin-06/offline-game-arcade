const canvas = document.getElementById('tetrisCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const restartButton = document.getElementById('restartButton');

const ROWS = 20;
const COLS = 12;
const BLOCK_SIZE = 30;

canvas.width = COLS * BLOCK_SIZE;
canvas.height = ROWS * BLOCK_SIZE;
ctx.scale(BLOCK_SIZE, BLOCK_SIZE);

const COLORS = [null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877F5'];

// FIX: The SHAPES array is now structured correctly as an array of 2D matrices.
const SHAPES = [
    [], // Placeholder for index 0
    [[1, 1, 1, 1]],           // I shape
    [[0, 2, 0], [2, 2, 2]],   // T shape
    [[3, 3, 0], [0, 3, 3]],   // Z shape
    [[0, 4, 4], [4, 4, 0]],   // S shape
    [[5, 5], [5, 5]],         // O shape
    [[6, 0, 0], [6, 6, 6]],   // L shape
    [[0, 0, 7], [7, 7, 7]]    // J shape
];

let board, player, dropCounter, dropInterval, gameLoopId;

function initializeGame() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    player = { pos: { x: 0, y: 0 }, matrix: null, score: 0 };
    dropCounter = 0;
    dropInterval = 1000;
    
    playerReset();
    updateScore();

    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
    }
    gameLoop();
}

function updateScore() {
    scoreElement.innerText = player.score;
}

function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrix(board, { x: 0, y: 0 });
    drawMatrix(player.matrix, player.pos);
}

function drawMatrix(matrix, offset) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                ctx.fillStyle = COLORS[value];
                ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

function merge() {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                board[y + player.pos.y][x + player.pos.x] = value;
            }
        });
    });
}

function collide(matrix, pos) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < matrix[y].length; ++x) {
            if (matrix[y][x] !== 0 && (board[y + pos.y] && board[y + pos.y][x + pos.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function rotate(matrix) {
    const newMatrix = matrix.map((_, index) => matrix.map(col => col[index]));
    return newMatrix.map(row => row.reverse());
}

function playerReset() {
    const typeId = Math.floor(Math.random() * (SHAPES.length - 1)) + 1;
    player.matrix = SHAPES[typeId];
    player.pos.y = 0;
    player.pos.x = Math.floor(COLS / 2) - Math.floor(player.matrix[0].length / 2);
    if (collide(player.matrix, player.pos)) {
        if (gameLoopId) cancelAnimationFrame(gameLoopId);
        ctx.fillStyle = 'white';
        ctx.font = '1px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', COLS / 2, ROWS / 2);
        ctx.textAlign = 'start';
    }
}

function playerMove(dir) {
    const newPos = { ...player.pos };
    newPos.x += dir;
    if (!collide(player.matrix, newPos)) {
        player.pos = newPos;
    }
}

function playerRotate() {
    const originalPos = { ...player.pos };
    const rotatedMatrix = rotate(player.matrix);
    
    if (!collide(rotatedMatrix, player.pos)) {
        player.matrix = rotatedMatrix;
        return;
    }

    // Wall kick logic
    for (let offset of [1, -1, 2, -2]) {
        const newPos = { ...player.pos };
        newPos.x += offset;
        if (!collide(rotatedMatrix, newPos)) {
            player.pos = newPos;
            player.matrix = rotatedMatrix;
            return;
        }
    }
}

function playerDrop() {
    const newPos = { ...player.pos };
    newPos.y++;
    if (!collide(player.matrix, newPos)) {
        player.pos = newPos;
    } else {
        merge();
        sweepBoard();
        playerReset();
    }
    dropCounter = 0;
}

function sweepBoard() {
    let rowCount = 1;
    outer: for (let y = board.length - 1; y > 0; --y) {
        for (let x = 0; x < board[y].length; ++x) {
            if (board[y][x] === 0) continue outer;
        }
        const row = board.splice(y, 1)[0].fill(0);
        board.unshift(row);
        y++;
        player.score += rowCount * 10;
        rowCount *= 2;
    }
    updateScore();
}

let lastTime = 0;
function gameLoop(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) playerDrop();
    draw();
    gameLoopId = requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') playerMove(-1);
    else if (event.key === 'ArrowRight') playerMove(1);
    else if (event.key === 'ArrowDown') playerDrop();
    else if (event.key === 'ArrowUp') playerRotate();
});

restartButton.addEventListener('click', initializeGame);

// Initial Game Start
initializeGame();