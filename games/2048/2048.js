document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.querySelector('.grid-container');
    const scoreDisplay = document.getElementById('score');
    const messageOverlay = document.getElementById('gameMessageOverlay');
    const messageText = document.getElementById('gameMessageText');
    const restartButton = document.getElementById('restartButton');
    const continueButton = document.getElementById('continueButton');
    const tryAgainButton = document.getElementById('tryAgainButton');
    const gridSize = 4;
    let grid = [];
    let score = 0;
    let isWon = false;

    function initializeGame() {
        grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
        score = 0;
        isWon = false;
        updateScore();
        messageOverlay.classList.remove('show');
        gridContainer.innerHTML = ''; // Clear old tiles
        drawBackgroundGrid();
        addRandomTile();
        addRandomTile();
        drawTiles();
    }

    function drawBackgroundGrid() {
        for (let i = 0; i < gridSize * gridSize; i++) {
            const cell = document.createElement('div');
            cell.classList.add('grid-cell');
            gridContainer.appendChild(cell);
        }
    }

    function drawTiles() {
        const existingTiles = document.querySelectorAll('.tile');
        existingTiles.forEach(tile => tile.remove());

        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                if (grid[r][c] !== 0) {
                    const tile = document.createElement('div');
                    tile.classList.add('tile');
                    tile.dataset.value = grid[r][c];
                    tile.textContent = grid[r][c];
                    tile.style.top = `${r * 115 + 15}px`;
                    tile.style.left = `${c * 115 + 15}px`;
                    gridContainer.appendChild(tile);
                }
            }
        }
    }

    function addRandomTile() {
        let emptyCells = [];
        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                if (grid[r][c] === 0) emptyCells.push({ r, c });
            }
        }
        if (emptyCells.length > 0) {
            const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            grid[r][c] = Math.random() < 0.9 ? 2 : 4;
        }
    }

    function updateScore() {
        scoreDisplay.textContent = score;
    }

    function handleInput(e) {
        if (messageOverlay.classList.contains('show')) return;
        let moved = false;
        switch (e.key) {
            case 'ArrowUp': moved = moveUp(); break;
            case 'ArrowDown': moved = moveDown(); break;
            case 'ArrowLeft': moved = moveLeft(); break;
            case 'ArrowRight': moved = moveRight(); break;
            default: return;
        }
        if (moved) {
            addRandomTile();
            drawTiles();
            checkGameState();
        }
    }

    function slideLine(line) {
        let filtered = line.filter(val => val !== 0);
        for (let i = 0; i < filtered.length - 1; i++) {
            if (filtered[i] === filtered[i + 1]) {
                filtered[i] *= 2;
                score += filtered[i];
                filtered.splice(i + 1, 1);
            }
        }
        let result = Array(gridSize).fill(0);
        filtered.forEach((val, index) => result[index] = val);
        return result;
    }

    function move(direction) {
        let hasChanged = false;
        let tempGrid = JSON.parse(JSON.stringify(grid)); // Deep copy

        for (let i = 0; i < gridSize; i++) {
            let line;
            if (direction === 'up' || direction === 'down') {
                line = tempGrid.map(row => row[i]);
            } else {
                line = [...tempGrid[i]];
            }

            if (direction === 'down' || direction === 'right') line.reverse();
            
            let newLine = slideLine(line);
            
            if (direction === 'down' || direction === 'right') newLine.reverse();

            for (let j = 0; j < gridSize; j++) {
                let currentVal;
                if (direction === 'up' || direction === 'down') {
                    currentVal = tempGrid[j][i];
                    tempGrid[j][i] = newLine[j];
                } else {
                    currentVal = tempGrid[i][j];
                    tempGrid[i][j] = newLine[j];
                }
                if (currentVal !== newLine[j]) hasChanged = true;
            }
        }
        if (hasChanged) {
            grid = tempGrid;
            updateScore();
        }
        return hasChanged;
    }

    function moveUp() { return move('up'); }
    function moveDown() { return move('down'); }
    function moveLeft() { return move('left'); }
    function moveRight() { return move('right'); }

    function checkGameState() {
        if (!isWon && grid.flat().includes(2048)) {
            messageText.textContent = "You Win!";
            continueButton.style.display = 'inline-block';
            tryAgainButton.style.display = 'none';
            messageOverlay.classList.add('show');
            isWon = true;
        }
        if (isGameOver()) {
            messageText.textContent = "Game Over!";
            continueButton.style.display = 'none';
            tryAgainButton.style.display = 'inline-block';
            messageOverlay.classList.add('show');
        }
    }

    function isGameOver() {
        if (grid.flat().includes(0)) return false;
        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                if (c < gridSize - 1 && grid[r][c] === grid[r][c + 1]) return false;
                if (r < gridSize - 1 && grid[r][c] === grid[r + 1][c]) return false;
            }
        }
        return true;
    }

    document.addEventListener('keydown', handleInput);
    restartButton.addEventListener('click', initializeGame);
    tryAgainButton.addEventListener('click', initializeGame);
    continueButton.addEventListener('click', () => messageOverlay.classList.remove('show'));

    initializeGame();
});