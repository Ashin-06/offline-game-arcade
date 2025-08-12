const canvas = document.getElementById('breakoutCanvas');
const ctx = canvas.getContext('2d');
const restartButton = document.getElementById('restartButton');
const speedSlider = document.getElementById('speedSlider');
const speedValueSpan = document.getElementById('speedValue');

// Game constants
const ballRadius = 10;
const paddleHeight = 15;
const paddleWidth = 100;
const brickRowCount = 5;
const brickColumnCount = 9;
const brickWidth = 75;
const brickHeight = 20;
const brickPadding = 10;
const brickOffsetTop = 30;
const brickOffsetLeft = 30;

// Game state variables
let x, y, dx, dy, paddleX, rightPressed, leftPressed, score, lives;
let bricks = [];
let gameLoopId;
let isPaused = false; // NEW: To handle pauses
let gameOver = false; // NEW: To handle game over state

function initializeGame() {
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
    }
    gameOver = false;
    isPaused = false;
    score = 0;
    lives = 3;
    rightPressed = false;
    leftPressed = false;
    createBricks();
    resetBallAndPaddle();
    gameLoop();
}

function resetBallAndPaddle() {
    x = canvas.width / 2;
    y = canvas.height - 50;
    paddleX = (canvas.width - paddleWidth) / 2;
    // Set initial speed and direction
    const speed = parseInt(speedSlider.value);
    const baseSpeed = 4;
    const speedMultiplier = speed / 4;
    dx = baseSpeed * speedMultiplier * (Math.random() < 0.5 ? 1 : -1); // Random horizontal start
    dy = -baseSpeed * speedMultiplier; // Always start going up
}

function createBricks() {
    bricks = [];
    for (let c = 0; c < brickColumnCount; c++) {
        bricks[c] = [];
        for (let r = 0; r < brickRowCount; r++) {
            bricks[c][r] = { x: 0, y: 0, status: 1 };
        }
    }
}

function updateSpeed() {
    const speed = parseInt(speedSlider.value);
    speedValueSpan.textContent = speed;
    
    // Don't change speed if paused or game is over, only update display
    if (isPaused || gameOver) return;

    const baseSpeed = 4;
    const speedMultiplier = speed / 4;
    
    // Preserve direction when changing speed
    const currentDxSign = Math.sign(dx) || 1;
    const currentDySign = Math.sign(dy) || -1;
    dx = baseSpeed * speedMultiplier * currentDxSign;
    dy = baseSpeed * speedMultiplier * currentDySign;
}

function collisionDetection() {
    for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
            const b = bricks[c][r];
            if (b.status === 1) {
                if (x > b.x && x < b.x + brickWidth && y > b.y && y < b.y + brickHeight) {
                    dy = -dy;
                    b.status = 0;
                    score++;
                    if (score === brickRowCount * brickColumnCount) {
                        gameOver = true;
                    }
                }
            }
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBricks();
    drawBall();
    drawPaddle();
    drawInfo();
}

function drawBall() {
    ctx.beginPath();
    ctx.arc(x, y, ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#0095DD";
    ctx.fill();
    ctx.closePath();
}

function drawPaddle() {
    ctx.beginPath();
    ctx.rect(paddleX, canvas.height - paddleHeight, paddleWidth, paddleHeight);
    ctx.fillStyle = "#0095DD";
    ctx.fill();
    ctx.closePath();
}

function drawBricks() {
    for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
            if (bricks[c][r].status === 1) {
                const brickX = (c * (brickWidth + brickPadding)) + brickOffsetLeft;
                const brickY = (r * (brickHeight + brickPadding)) + brickOffsetTop;
                bricks[c][r].x = brickX;
                bricks[c][r].y = brickY;
                ctx.beginPath();
                ctx.rect(brickX, brickY, brickWidth, brickHeight);
                ctx.fillStyle = "#0095DD";
                ctx.fill();
                ctx.closePath();
            }
        }
    }
}

function drawInfo() {
    ctx.font = "16px Arial";
    ctx.fillStyle = "#0095DD";
    ctx.fillText("Score: " + score, 8, 20);
    ctx.fillText("Lives: " + lives, canvas.width - 65, 20);
}

function gameLoop() {
    // NEW: Handle Game Over state
    if (gameOver) {
        ctx.font = "50px Arial";
        ctx.fillStyle = "red";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
        ctx.textAlign = "start";
        return; // Stop the game loop
    }

    draw();

    // NEW: Handle pause state after losing a life
    if (isPaused) {
        gameLoopId = requestAnimationFrame(gameLoop);
        return;
    }

    collisionDetection();

    // Wall collision
    if (x + dx > canvas.width - ballRadius || x + dx < ballRadius) dx = -dx;
    if (y + dy < ballRadius) dy = -dy;
    else if (y + dy > canvas.height - ballRadius) {
        if (x > paddleX && x < paddleX + paddleWidth) {
            dy = -dy;
        } else {
            lives--;
            if (!lives) {
                gameOver = true;
            } else {
                // NEW: Pause for 1.5 seconds after losing a life
                isPaused = true;
                setTimeout(() => {
                    resetBallAndPaddle();
                    isPaused = false;
                }, 1500);
            }
        }
    }

    if (rightPressed && paddleX < canvas.width - paddleWidth) paddleX += 7;
    else if (leftPressed && paddleX > 0) paddleX -= 7;

    x += dx;
    y += dy;

    gameLoopId = requestAnimationFrame(gameLoop);
}

// --- Event Listeners ---
document.addEventListener("keydown", (e) => {
    if (e.key === "Right" || e.key === "ArrowRight") rightPressed = true;
    else if (e.key === "Left" || e.key === "ArrowLeft") leftPressed = true;
});
document.addEventListener("keyup", (e) => {
    if (e.key === "Right" || e.key === "ArrowRight") rightPressed = false;
    else if (e.key === "Left" || e.key === "ArrowLeft") leftPressed = false;
});
restartButton.addEventListener('click', () => {
    initializeGame();
    restartButton.blur();
});
speedSlider.addEventListener('input', updateSpeed);

// --- Initial Game Start ---
initializeGame();