const canvas = document.getElementById('platformerCanvas');
const ctx = canvas.getContext('2d');

const GRAVITY = 0.6;
const JUMP_STRENGTH = 15;
const PLAYER_SPEED = 5;

const player = { x: 50, y: 500, width: 30, height: 50, velocityX: 0, velocityY: 0, isJumping: true };
// CHANGED: Added many more platforms to create a larger level
const platforms = [
    { x: 0, y: canvas.height - 20, width: canvas.width, height: 20 }, // Floor
    { x: 150, y: canvas.height - 80, width: 150, height: 20 },
    { x: 400, y: canvas.height - 150, width: 150, height: 20 },
    { x: 600, y: canvas.height - 250, width: 100, height: 20 },
    { x: 450, y: canvas.height - 350, width: 100, height: 20 },
    { x: 200, y: canvas.height - 420, width: 180, height: 20 },
    { x: 50, y: canvas.height - 500, width: 100, height: 20 },
];
const keys = { right: false, left: false, up: false };

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;
    if (e.key === ' ' || e.key === 'ArrowUp') keys.up = true; // Space or ArrowUp to jump
});
document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
    if (e.key === ' ' || e.key === 'ArrowUp') keys.up = false;
});

function update() {
    // Handle input
    if (keys.right) player.velocityX = PLAYER_SPEED;
    else if (keys.left) player.velocityX = -PLAYER_SPEED;
    else player.velocityX = 0;

    // FIX: Correct jump logic
    if (keys.up && !player.isJumping) {
        player.velocityY = -JUMP_STRENGTH;
        player.isJumping = true;
    }

    // Apply gravity and update position
    player.velocityY += GRAVITY;
    player.x += player.velocityX;
    player.y += player.velocityY;

    // Prevent player from moving off-screen horizontally
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    // Platform collision
    player.isJumping = true; // Assume jumping unless a platform is hit
    platforms.forEach(platform => {
        if (
            player.velocityY >= 0 && // Only collide when falling
            player.x < platform.x + platform.width &&
            player.x + player.width > platform.x &&
            player.y + player.height > platform.y &&
            player.y + player.height < platform.y + platform.height + player.velocityY
        ) {
            player.y = platform.y - player.height;
            player.velocityY = 0;
            player.isJumping = false; // Player is on a platform, can jump again
        }
    });

    if (player.y > canvas.height) { // Reset if falls off bottom
        player.x = 50;
        player.y = 500;
        player.velocityY = 0;
    }

    // --- Drawing ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'green';
    platforms.forEach(p => ctx.fillRect(p.x, p.y, p.width, p.height));
    ctx.fillStyle = 'blue';
    ctx.fillRect(player.x, player.y, player.width, player.height);

    requestAnimationFrame(update);
}

update();