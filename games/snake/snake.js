const canvas = document.getElementById('snakeCanvas');
const ctx = canvas.getContext('2d');

// NEW: Get references to UI elements
const speedSlider = document.getElementById('speedSlider');
const speedValueSpan = document.getElementById('speedValue');
const restartButton = document.getElementById('restartButton');

// Game Constants
const gridSize = 20;
const tileCount = canvas.width / gridSize;

// Game State Variables
let snake, food, score, dx, dy, gameOver;

function initializeGame() {
    snake = [{ x: 10, y: 10 }]; // Snake starts as a single block
    food = {};
    score = 0;
    dx = 0; // Not moving initially
    dy = 0;
    gameOver = false;
    generateFood();
    updateSpeedDisplay();
}

function getGameSpeed() {
    // Converts slider value (1-10) to a millisecond delay.
    // A higher slider value means a lower delay (faster snake).
    const speed = parseInt(speedSlider.value);
    return 220 - (speed * 20);
}

function updateSpeedDisplay() {
    speedValueSpan.textContent = speedSlider.value;
}

function gameLoop() {
    if (gameOver) {
        ctx.fillStyle = 'white';
        ctx.font = '50px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
        ctx.textAlign = 'start';
        return; // Stop the loop
    }

    update();
    draw();
    
    // Call the next loop cycle with a delay based on speed
    setTimeout(gameLoop, getGameSpeed());
}

function update() {
    // FIX: Don't update game state if the snake isn't moving yet
    if (dx === 0 && dy === 0) return;

    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    // Wall collision check
    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
        gameOver = true;
        return;
    }
    // Self collision check
    for (let i = 0; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            gameOver = true;
            return;
        }
    }

    snake.unshift(head); // Add new head

    // Food collision
    if (head.x === food.x && head.y === food.y) {
        score++;
        generateFood();
    } else {
        snake.pop(); // Only remove tail if no food was eaten
    }
}

function draw() {
    // Black background
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw snake
    ctx.fillStyle = 'lime';
    snake.forEach(segment => {
        ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize - 2, gridSize - 2);
    });

    // Draw food
    ctx.fillStyle = 'red';
    ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize - 2, gridSize - 2);

    // Draw score
    ctx.fillStyle = 'white';
    ctx.font = '20px sans-serif';
    ctx.fillText(`Score: ${score}`, 10, 25);
}

function generateFood() {
    food.x = Math.floor(Math.random() * tileCount);
    food.y = Math.floor(Math.random() * tileCount);
    // Avoid spawning food on the snake
    for (const segment of snake) {
        if (segment.x === food.x && segment.y === food.y) {
            generateFood(); // Recursively try again
            return;
        }
    }
}

// --- Event Listeners ---
document.addEventListener('keydown', (e) => {
    // Prevent the snake from reversing on itself
    switch (e.key) {
        case 'ArrowUp':
            if (dy === 0) { dx = 0; dy = -1; }
            break;
        case 'ArrowDown':
            if (dy === 0) { dx = 0; dy = 1; }
            break;
        case 'ArrowLeft':
            if (dx === 0) { dx = -1; dy = 0; }
            break;
        case 'ArrowRight':
            if (dx === 0) { dx = 1; dy = 0; }
            break;
    }
});

speedSlider.addEventListener('input', updateSpeedDisplay);
restartButton.addEventListener('click', () => {
    initializeGame();
    gameLoop(); // Start a new game loop
});


// --- Initial Game Start ---
initializeGame();
gameLoop();