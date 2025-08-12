const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');

// Get references to all the new UI elements
const winningScoreInput = document.getElementById('winningScoreInput');
const speedSlider = document.getElementById('speedSlider');
const speedValueSpan = document.getElementById('speedValue');
const restartButton = document.getElementById('restartButton');

// Game Constants
const paddleHeight = 100;
const paddleWidth = 10;
const PADDLE_SPEED = 8;
const ballRadius = 10;

// --- FIX: Initialize all game state variables with default values ---
let leftPaddleY = canvas.height / 2 - paddleHeight / 2;
let rightPaddleY = canvas.height / 2 - paddleHeight / 2;
let ballX = canvas.width / 2;
let ballY = canvas.height / 2;
let ballSpeedX = 0; // Ball starts stationary
let ballSpeedY = 0;
let playerScore = 0;
let computerScore = 0;
let gameMessage = "Click to Start"; // Initial message
let isPaused = true;

function updateBallSpeed() {
    speedValueSpan.textContent = speedSlider.value;
}

function serveBall(direction) {
    isPaused = true;
    ballX = canvas.width / 2;
    ballY = canvas.height / 2;
    gameMessage = "Get Ready...";

    // Wait 1 second before launching the ball
    setTimeout(() => {
        const speed = parseInt(speedSlider.value);
        ballSpeedX = speed * direction;
        ballSpeedY = speed * (Math.random() > 0.5 ? 1 : -1);
        isPaused = false;
        gameMessage = "";
    }, 1000);
}

function checkWinCondition() {
    const targetScore = parseInt(winningScoreInput.value);
    if (!isPaused && playerScore >= targetScore) {
        gameMessage = "You Win!";
        isPaused = true;
    } else if (!isPaused && computerScore >= targetScore) {
        gameMessage = "Computer Wins!";
        isPaused = true;
    } else {
        serveBall(ballSpeedX > 0 ? -1 : 1);
    }
}

function restartGame() {
    playerScore = 0;
    computerScore = 0;
    updateScoreDisplay(); // FIX: Update score display on restart
    serveBall(1);
}

function updateScoreDisplay() {
    // This logic is now part of the drawing section to always be up-to-date
}

function gameLoop() {
    // --- Update Logic ---
    if (!isPaused) {
        ballX += ballSpeedX;
        ballY += ballSpeedY;

        if (ballY > rightPaddleY + paddleHeight / 2) rightPaddleY += PADDLE_SPEED / 1.5;
        if (ballY < rightPaddleY + paddleHeight / 2) rightPaddleY -= PADDLE_SPEED / 1.5;

        if (ballY + ballRadius > canvas.height || ballY - ballRadius < 0) {
            ballSpeedY *= -1;
        }

        if (ballX - ballRadius < paddleWidth && ballY > leftPaddleY && ballY < leftPaddleY + paddleHeight) {
            ballSpeedX *= -1;
        } else if (ballX + ballRadius > canvas.width - paddleWidth && ballY > rightPaddleY && ballY < rightPaddleY + paddleHeight) {
            ballSpeedX *= -1;
        }

        if (ballX < 0) {
            computerScore++;
            checkWinCondition();
        } else if (ballX > canvas.width) {
            playerScore++;
            checkWinCondition();
        }
    }

    // --- Drawing Logic (This now runs every frame, even when paused) ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    // Paddles
    ctx.fillRect(0, leftPaddleY, paddleWidth, paddleHeight);
    ctx.fillRect(canvas.width - paddleWidth, rightPaddleY, paddleWidth, paddleHeight);
    // Ball
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    ctx.fill();
    // Scores
    ctx.font = '40px sans-serif';
    ctx.fillText(playerScore, canvas.width / 4, 50);
    ctx.fillText(computerScore, 3 * canvas.width / 4, 50);
    // Center line
    ctx.strokeStyle = '#555';
    ctx.setLineDash([10, 15]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();

    if (gameMessage) {
        ctx.font = '50px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(gameMessage, canvas.width / 2, canvas.height / 2 - 50);
        ctx.textAlign = 'start';
    }

    requestAnimationFrame(gameLoop);
}

// --- Event Listeners ---
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    leftPaddleY = mouseY - paddleHeight / 2;
    if (leftPaddleY < 0) leftPaddleY = 0;
    if (leftPaddleY + paddleHeight > canvas.height) leftPaddleY = canvas.height - paddleHeight;
});

canvas.addEventListener('click', () => {
    // FIX: Only start the game if it's in the initial "Click to Start" state
    if (gameMessage === "Click to Start") {
        restartGame();
    }
});

speedSlider.addEventListener('input', updateBallSpeed);
restartButton.addEventListener('click', restartGame);

// --- Initialize Game ---
updateBallSpeed();
gameLoop(); // FIX: Just start the game loop. The game is paused by default.