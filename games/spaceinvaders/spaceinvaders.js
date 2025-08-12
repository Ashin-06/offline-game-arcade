const canvas = document.getElementById('invadersCanvas');
const ctx = canvas.getContext('2d');
const restartButton = document.getElementById('restartButton');
const speedSlider = document.getElementById('speedSlider');
const speedValueSpan = document.getElementById('speedValue');

// Game State
let player, bullets, aliens, alienBullets, alienDirection, score, gameOver, keys;
let gameLoopId; // NEW: To keep track of the animation frame

function initializeGame() {
    // NEW: Stop any previous game loop before starting a new one
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
    }

    player = { x: canvas.width / 2 - 20, y: canvas.height - 50, width: 40, height: 20, speed: 5 };
    bullets = [];
    aliens = [];
    alienBullets = [];
    alienDirection = 1;
    score = 0;
    gameOver = false;
    keys = {};
    createAliens();
    updateSpeedDisplay();
    gameLoop(); // Start the game loop
}

function updateSpeedDisplay() {
    speedValueSpan.textContent = speedSlider.value;
}

function createAliens() {
    aliens.length = 0;
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 14; col++) {
            aliens.push({ x: col * 45 + 50, y: row * 35 + 30, width: 20, height: 20 });
        }
    }
}

function displayMessage(message, subtext = '') {
    ctx.fillStyle = 'white';
    ctx.font = '60px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
    if (subtext) {
        ctx.font = '25px sans-serif';
        ctx.fillText(subtext, canvas.width / 2, canvas.height / 2 + 50);
    }
    ctx.textAlign = 'start';
}

function gameLoop() {
    if (gameOver) {
        if (aliens.length === 0) {
            displayMessage('YOU WIN!', `Final Score: ${score}`);
        } else {
            displayMessage('GAME OVER', `Final Score: ${score}`);
        }
        return; // Stop the loop when the game is over
    }

    // --- Update positions ---
    if (keys['ArrowLeft']) player.x -= player.speed;
    if (keys['ArrowRight']) player.x += player.speed;
    // Clamp player position to screen bounds
    player.x = Math.max(0, Math.min(player.x, canvas.width - player.width));

    bullets.forEach((b, i) => { b.y -= 7; if (b.y < 0) bullets.splice(i, 1); });
    alienBullets.forEach((b, i) => { b.y += 4; if (b.y > canvas.height) alienBullets.splice(i, 1); });

    const invaderSpeed = parseInt(speedSlider.value) * 0.1 + 0.1;

    let wallHit = false;
    aliens.forEach(a => {
        a.x += invaderSpeed * alienDirection;
        if (a.x <= 0 || a.x + a.width >= canvas.width) wallHit = true;
    });
    if (wallHit) {
        alienDirection *= -1;
        aliens.forEach(a => a.y += 10);
    }

    const shootProbability = parseInt(speedSlider.value) * 0.002;
    if (Math.random() < shootProbability && aliens.length > 0) {
        const randomAlien = aliens[Math.floor(Math.random() * aliens.length)];
        alienBullets.push({ x: randomAlien.x + randomAlien.width / 2, y: randomAlien.y, width: 3, height: 10 });
    }

    // --- Collision detection ---
    bullets.forEach((bullet, bIndex) => {
        aliens.forEach((alien, aIndex) => {
            if (bullet.x > alien.x && bullet.x < alien.x + alien.width && bullet.y > alien.y && bullet.y < alien.y + alien.height) {
                aliens.splice(aIndex, 1);
                bullets.splice(bIndex, 1);
                score += 10;
            }
        });
    });

    alienBullets.forEach((bullet) => {
        if (bullet.x > player.x && bullet.x < player.x + player.width && bullet.y > player.y && bullet.y < player.y + player.height) {
            gameOver = true;
        }
    });

    // Check Game Over Conditions
    aliens.forEach(a => { if (a.y + a.height >= player.y) gameOver = true; });
    if (aliens.length === 0 && score > 0) gameOver = true;

    // --- Drawing ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'lime'; ctx.fillRect(player.x, player.y, player.width, player.height);
    ctx.fillStyle = 'yellow'; bullets.forEach(b => ctx.fillRect(b.x - 2, b.y, 4, 10));
    ctx.fillStyle = 'red'; aliens.forEach(a => ctx.fillRect(a.x, a.y, a.width, a.height));
    ctx.fillStyle = 'orange'; alienBullets.forEach(b => ctx.fillRect(b.x - b.width / 2, b.y, b.width, b.height));
    ctx.fillStyle = 'white'; ctx.font = '20px sans-serif'; ctx.fillText(`Score: ${score}`, 10, 25);

    // FIX: Continue the loop using a tracked ID
    gameLoopId = requestAnimationFrame(gameLoop);
}

// --- Event Listeners ---
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    // NEW: Added 'ArrowUp' as a key to fire projectiles
    if ((e.key === ' ' || e.key === 'ArrowUp') && !gameOver) {
        // Prevent default browser action for space/arrow keys (e.g., scrolling)
        e.preventDefault();
        if (bullets.length < 4) {
            bullets.push({ x: player.x + player.width / 2, y: player.y });
        }
    }
});
document.addEventListener('keyup', (e) => { keys[e.key] = false; });

// FIX: Updated restart button logic
restartButton.addEventListener('click', () => {
    initializeGame();
    restartButton.blur(); // Remove focus from the button
});

speedSlider.addEventListener('input', updateSpeedDisplay);

// --- Initial Game Start ---
initializeGame();