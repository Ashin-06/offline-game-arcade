const gameContainer = document.querySelector('.memory-game');
const movesCountSpan = document.getElementById('moves-count');
const scoreCountSpan = document.getElementById('score-count');
const newGameButton = document.getElementById('newGameButton');
const pairsInput = document.getElementById('pairsInput');
const matchCountInput = document.getElementById('matchCountInput');

const EMOJI_POOL = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵'];

let flippedCards = [];
let matchedPairs = 0;
let moves = 0;
let score = 0;
let lockBoard = false;
let uniqueItems, matchCount, totalCards;

function initializeGame() {
    // Read settings
    uniqueItems = parseInt(pairsInput.value);
    matchCount = parseInt(matchCountInput.value);
    totalCards = uniqueItems * matchCount;

    // Reset game state
    moves = 0;
    score = 0;
    matchedPairs = 0;
    movesCountSpan.textContent = moves;
    scoreCountSpan.textContent = score;
    gameContainer.innerHTML = '';
    
    // Create the array of cards
    const selectedEmojis = EMOJI_POOL.slice(0, uniqueItems);
    let cardsArray = [];
    for (let i = 0; i < matchCount; i++) {
        cardsArray.push(...selectedEmojis);
    }
    cardsArray.sort(() => Math.random() - 0.5);

    // Set up grid layout
    const columns = Math.ceil(Math.sqrt(totalCards));
    gameContainer.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;

    // Create card elements
    cardsArray.forEach(emoji => {
        const card = document.createElement('div');
        card.classList.add('memory-card');
        card.dataset.emoji = emoji;
        card.innerHTML = `
            <div class="front-face"></div>
            <div class="back-face">${emoji}</div>
        `;
        gameContainer.appendChild(card);
        card.addEventListener('click', flipCard);
    });
}

function flipCard() {
    if (lockBoard || this.classList.contains('flip')) return;

    this.classList.add('flip');
    flippedCards.push(this);

    if (flippedCards.length === matchCount) {
        moves++;
        movesCountSpan.textContent = moves;
        checkForMatch();
    }
}

function checkForMatch() {
    lockBoard = true;
    const firstCardEmoji = flippedCards[0].dataset.emoji;
    const isMatch = flippedCards.every(card => card.dataset.emoji === firstCardEmoji);

    if (isMatch) {
        score += 10 * matchCount; // More points for bigger matches
        scoreCountSpan.textContent = score;
        disableCards();
    } else {
        unflipCards();
    }
}

function disableCards() {
    flippedCards.forEach(card => card.removeEventListener('click', flipCard));
    matchedPairs++;
    resetBoard();
    if (matchedPairs === uniqueItems) {
        setTimeout(() => alert(`You won in ${moves} moves! Final Score: ${score}`), 500);
    }
}

function unflipCards() {
    setTimeout(() => {
        flippedCards.forEach(card => card.classList.remove('flip'));
        resetBoard();
    }, 1200);
}

function resetBoard() {
    [flippedCards, lockBoard] = [[], false];
}

newGameButton.addEventListener('click', initializeGame);

// Initial Game Start
initializeGame();