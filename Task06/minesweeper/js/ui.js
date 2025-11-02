class GameUI {
    constructor() {
        this.game = null;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Главное меню
        document.getElementById('new-game-btn').addEventListener('click', () => this.showGameSetup());
        
        // Настройка игры
        document.getElementById('start-game-btn').addEventListener('click', () => this.startNewGame());
        document.getElementById('back-to-menu-btn').addEventListener('click', () => this.showMainMenu());

        // Игра
        document.getElementById('back-to-menu-from-game').addEventListener('click', () => this.showMainMenu());
    }

    showMainMenu() {
        this.hideAllSections();
        document.getElementById('main-menu').classList.remove('hidden');
    }

    showGameSetup() {
        this.hideAllSections();
        document.getElementById('game-setup').classList.remove('hidden');
    }

    hideAllSections() {
        const sections = document.querySelectorAll('.menu-section, #game-section');
        sections.forEach(section => section.classList.add('hidden'));
    }

    startNewGame() {
        const playerName = document.getElementById('player-name').value.trim();
        const size = parseInt(document.getElementById('field-size').value);
        const minesCount = parseInt(document.getElementById('mines-count').value);

        if (!playerName) {
            alert('Пожалуйста, введите имя игрока');
            return;
        }

        if (minesCount >= size * size) {
            alert('Количество мин не может быть больше или равно количеству ячеек');
            return;
        }

        if (minesCount <= 0) {
            alert('Количество мин должно быть больше 0');
            return;
        }

        this.game = new MinesweeperGame(size, minesCount, playerName);
        this.showGameInterface();
        this.renderBoard();
    }

    showGameInterface() {
        this.hideAllSections();
        document.getElementById('game-section').classList.remove('hidden');
        
        document.getElementById('current-player').textContent = this.game.playerName;
        document.getElementById('current-size').textContent = `${this.game.size}×${this.game.size}`;
        document.getElementById('current-mines').textContent = this.game.minesCount;
        this.updateGameStatus();
    }

    renderBoard() {
        const boardElement = document.getElementById('game-board');
        boardElement.innerHTML = '';
        boardElement.style.gridTemplateColumns = `repeat(${this.game.size}, 30px)`;

        for (let x = 0; x < this.game.size; x++) {
            for (let y = 0; y < this.game.size; y++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.x = x;
                cell.dataset.y = y;

                const cellData = this.game.board[x][y];

                if (cellData.revealed) {
                    cell.classList.add('revealed');
                    if (cellData.isMine) {
                        cell.classList.add('mine');
                        cell.textContent = '💣';
                    } else if (cellData.number > 0) {
                        cell.textContent = cellData.number;
                        cell.style.color = this.getNumberColor(cellData.number);
                    }
                } else if (cellData.flagged) {
                    cell.classList.add('flag');
                    cell.textContent = '🚩';
                }

                cell.addEventListener('click', (e) => this.handleCellClick(e, x, y));
                cell.addEventListener('contextmenu', (e) => this.handleRightClick(e, x, y));

                boardElement.appendChild(cell);
            }
        }
    }

    getNumberColor(number) {
        const colors = [
            '#0000FF', // 1 - синий
            '#008000', // 2 - зеленый
            '#FF0000', // 3 - красный
            '#000080', // 4 - темно-синий
            '#800000', // 5 - темно-красный
            '#008080', // 6 - бирюзовый
            '#000000', // 7 - черный
            '#808080'  // 8 - серый
        ];
        return colors[number - 1] || '#000000';
    }

    handleCellClick(event, x, y) {
        if (this.game.gameOver) return;

        const result = this.game.revealCell(x, y);
        this.renderBoard();
        this.updateGameStatus();

        if (result === 'mine') {
            setTimeout(() => {
                alert('К сожалению, вы проиграли! Попробуйте еще раз.');
            }, 100);
        } else if (result === 'win') {
            setTimeout(() => {
                alert('Поздравляем! Вы выиграли!');
            }, 100);
        }
    }

    handleRightClick(event, x, y) {
        event.preventDefault();
        if (this.game.gameOver) return;

        this.game.toggleFlag(x, y);
        this.renderBoard();
        this.updateGameStatus();
    }

    updateGameStatus() {
        const statusElement = document.getElementById('game-status');
        const moveCountElement = document.getElementById('move-count');
        const flagCountElement = document.getElementById('flag-count');

        moveCountElement.textContent = this.game.moveCount;
        flagCountElement.textContent = this.game.getFlagCount();

        if (this.game.gameWon) {
            statusElement.textContent = 'Поздравляем! Вы выиграли!';
            statusElement.style.color = 'green';
        } else if (this.game.gameOver) {
            statusElement.textContent = 'Игра окончена. Вы проиграли.';
            statusElement.style.color = 'red';
        } else {
            statusElement.textContent = `Игра идет... Осталось мин: ${this.game.getRemainingMines()}`;
            statusElement.style.color = 'black';
        }
    }
}