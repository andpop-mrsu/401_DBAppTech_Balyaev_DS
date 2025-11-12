class GameUI {
    constructor(db) {
        this.db = db;
        this.game = null;
        this.moveHistory = []; // ← для сохранения ходов
        this.isReplaying = false;
        this.replayMoves = [];
        this.replayIndex = 0;

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Главное меню
        document.getElementById('new-game-btn').addEventListener('click', () => this.showGameSetup());
        document.getElementById('view-games-btn').addEventListener('click', () => this.showGamesList());
        
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
        const sections = document.querySelectorAll('.menu-section, #game-section, #games-list-section');
        sections.forEach(section => {
            if (section.id === 'games-list-section') {
                section.remove();
            } else {
                section.classList.add('hidden');
            }
        });
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
        this.moveHistory = [];
        this.isReplaying = false;

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

        // Сохраняем ход только при обычной игре
        if (!this.isReplaying) {
            const moveResult = 
                result === 'mine' ? 'взорвался' :
                result === 'win'  ? 'выиграл' :
                'мины нет';
            
            this.moveHistory.push({ x, y, result: moveResult });
        }

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

        // 🔥 Автосохранение при окончании игры
        if ((this.game.gameWon || this.game.gameOver) && !this.isReplaying && this.moveHistory.length > 0) {
            this.saveGameToDB();
        }
    }

    async saveGameToDB() {
        if (!this.db) return;

        try {
            const gameData = {
                player: this.game.playerName,
                size: this.game.size,
                mines: this.game.minesCount,
                minePositions: this.game.minePositions,
                status: this.game.gameWon ? 'win' : 'lose',
                moves: this.moveHistory
            };

            const gameId = await this.db.saveGame(gameData);
            console.log(`Игра сохранена в БД под ID: ${gameId}`);
        } catch (error) {
            console.error('Ошибка сохранения игры:', error);
            alert('Не удалось сохранить игру. Проверьте консоль.');
        }
    }

    // =================== СПИСОК ПАРТИЙ ===================
    async showGamesList() {
        this.hideAllSections();
        const container = document.createElement('div');
        container.id = 'games-list-section';
        container.className = 'menu-section';
        container.innerHTML = `
            <h2>Сохранённые партии</h2>
            <div id="games-list"><p>Загрузка...</p></div>
            <button id="back-to-menu-from-list">← Назад</button>
        `;
        document.querySelector('.container').appendChild(container);

        try {
            const games = await this.db.getAllGames();
            const listEl = document.getElementById('games-list');
            
            if (games.length === 0) {
                listEl.innerHTML = '<p>Нет сохранённых партий.</p>';
            } else {
                const table = document.createElement('table');
                table.innerHTML = `
                    <thead>
                        <tr>
                            <th>Дата</th>
                            <th>Игрок</th>
                            <th>Поле</th>
                            <th>Мины</th>
                            <th>Исход</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                `;
                const tbody = table.querySelector('tbody');

                games.forEach(game => {
                    const row = document.createElement('tr');
                    const date = new Date(game.date).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    const statusText = game.status === 'win' ? 'Победа 🏆' : 'Поражение 💣';
                    row.innerHTML = `
                        <td>${date}</td>
                        <td>${game.player || '—'}</td>
                        <td>${game.size}×${game.size}</td>
                        <td>${game.mines}</td>
                        <td>${statusText}</td>
                        <td>
                            <button class="replay-btn" data-id="${game.id}">Повторить</button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });

                listEl.innerHTML = '';
                listEl.appendChild(table);

                // Обработчик повтора
                document.querySelectorAll('.replay-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const gameId = e.target.dataset.id;
                        this.startReplay(gameId);
                    });
                });
            }

            document.getElementById('back-to-menu-from-list').addEventListener('click', () => {
                container.remove();
                this.showMainMenu();
            });

        } catch (error) {
            console.error(error);
            document.getElementById('games-list').innerHTML = 
                `<p style="color:red">Ошибка загрузки: ${error.message}</p>`;
        }
    }

    // =================== РЕЖИМ ВОСПРОИЗВЕДЕНИЯ ===================
    async startReplay(gameId) {
        try {
            const gameData = await this.db.getGameById(gameId);
            const moves = await this.db.getGameMoves(gameId);

            if (!gameData || !Array.isArray(moves) || moves.length === 0) {
                alert('Невозможно загрузить игру: данные повреждены.');
                return;
            }

            // Создаём новую игру с ТЕМИ ЖЕ параметрами
            this.game = new MinesweeperGame(gameData.size, gameData.mines, gameData.player);
            
            // 🔥 Восстанавливаем ТОЧНУЮ расстановку мин
            this.game.minePositions = gameData.minePositions;
            this.game.initializeBoard(); // сброс доски

            gameData.minePositions.forEach(pos => {
                if (this.game.isValidPosition(pos.x, pos.y)) {
                    this.game.board[pos.x][pos.y].isMine = true;
                }
            });
            this.game.calculateNumbers();

            // Подготавливаем воспроизведение
            this.isReplaying = true;
            this.replayMoves = moves;
            this.replayIndex = 0;
            this.moveHistory = []; // не сохраняем при воспроизведении

            this.showGameInterface();
            this.renderBoard();

            // Запускаем первый ход с задержкой
            setTimeout(() => this.playNextMove(), 800);
        } catch (error) {
            console.error('Ошибка воспроизведения:', error);
            alert('Не удалось загрузить игру для повтора.');
        }
    }

    playNextMove() {
        if (this.replayIndex >= this.replayMoves.length || this.game.gameOver) {
            return;
        }

        const move = this.replayMoves[this.replayIndex];

        // В оригинале: только открытие ячейки (без флагов — по ТЗ)
        this.game.revealCell(move.x, move.y);
        this.renderBoard();
        this.updateGameStatus();

        console.log(`[Replay] Ход ${move.moveNumber}: (${move.x}, ${move.y}) → ${move.result}`);

        this.replayIndex++;

        if (!this.game.gameOver && this.replayIndex < this.replayMoves.length) {
            setTimeout(() => this.playNextMove(), 600);
        } else {
            const resultText = this.game.gameWon 
                ? 'Победа! 🎉' 
                : 'Поражение. 💣';
            setTimeout(() => {
                alert(`Воспроизведение завершено.\n${resultText}`);
            }, 500);
        }
    }
}