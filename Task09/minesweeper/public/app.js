const app = {
    apiUrl: '', // Относительный путь, т.к. SPA на том же домене

    currentGame: {
        id: null,
        width: 0,
        height: 0,
        minesLocations: [], // Индексы мин (row * width + col)
        stepCount: 0,
        isReplay: false,
        replayMoves: [],
        replayIndex: 0
    },

    init: function () {
        document.getElementById('new-game-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.startNewGame();
        });
    },

    // --- API Calls ---

    async createGame(data) {
        const response = await fetch(`${this.apiUrl}/games`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    },

    async sendStep(gameId, stepData) {
        await fetch(`${this.apiUrl}/step/${gameId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stepData)
        });
    },

    async getGames() {
        const response = await fetch(`${this.apiUrl}/games`);
        return await response.json();
    },

    async getGameDetails(id) {
        const response = await fetch(`${this.apiUrl}/games/${id}`);
        return await response.json();
    },

    // --- UI Logic ---

    showScreen: function (screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById(screenId).classList.remove('hidden');
    },

    showNewGameScreen: function () {
        this.showScreen('screen-new-game');
    },

    async loadGamesList() {
        this.showScreen('screen-list');
        const games = await this.getGames();
        const tbody = document.getElementById('games-table-body');
        tbody.innerHTML = '';

        games.forEach(game => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${game.id}</td>
                <td>${game.date}</td>
                <td>${game.player_name}</td>
                <td>${game.width}x${game.height}</td>
                <td>${game.mines_count}</td>
                <td>${game.status === 'playing' ? 'Не окончена' : (game.status === 'won' ? 'Победа' : 'Поражение')}</td>
                <td><button onclick="app.loadReplay(${game.id})">Повтор</button></td>
            `;
            tbody.appendChild(tr);
        });
    },

    // --- Game Logic ---

    startNewGame: async function () {
        const name = document.getElementById('player-name').value;
        const size = parseInt(document.getElementById('grid-size').value);
        const minesCount = parseInt(document.getElementById('mines-count').value);

        if (minesCount >= size * size) {
            alert("Слишком много мин!");
            return;
        }

        // Генерируем мины на клиенте
        const mines = new Set();
        while (mines.size < minesCount) {
            mines.add(Math.floor(Math.random() * (size * size)));
        }
        const minesArray = Array.from(mines);

        // Отправляем на сервер
        const gameData = {
            player_name: name,
            width: size,
            height: size,
            mines_count: minesCount,
            mine_locations: minesArray
        };

        const result = await this.createGame(gameData);

        this.currentGame = {
            id: result.id,
            width: size,
            height: size,
            minesLocations: minesArray,
            stepCount: 0,
            isReplay: false,
            gameOver: false
        };

        this.renderGrid(size, size);
        this.showScreen('screen-game');
        document.getElementById('game-status').innerText = "Идет игра...";
        document.getElementById('replay-next-btn').classList.add('hidden');
    },

    renderGrid: function (width, height) {
        const grid = document.getElementById('minesweeper-grid');
        grid.innerHTML = '';
        grid.style.gridTemplateColumns = `repeat(${width}, 30px)`;

        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.row = r;
                cell.dataset.col = c;
                cell.dataset.index = r * width + c;

                if (!this.currentGame.isReplay) {
                    // Левая кнопка мыши (открытие)
                    cell.addEventListener('click', () => this.handleCellClick(r, c));

                    // Правая кнопка мыши (флажок) -> НОВОЕ
                    cell.addEventListener('contextmenu', (e) => this.handleRightClick(e, r, c));
                }
                grid.appendChild(cell);
            }
        }
    },

    handleCellClick: async function (r, c) {
        if (this.currentGame.gameOver || this.currentGame.isReplay) return;

        const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
        if (cell.classList.contains('open')) return;

        const index = r * this.currentGame.width + c;
        const isMine = this.currentGame.minesLocations.includes(index);

        let resultStr = 'ok';

        if (isMine) {
            cell.classList.add('mine', 'open');
            cell.innerText = '💣';
            this.currentGame.gameOver = true;
            resultStr = 'exploded';
            document.getElementById('game-status').innerText = "ВЫ ВЗОРВАЛИСЬ!";
            this.revealAllMines();
        } else {
            // Считаем мины вокруг
            const minesAround = this.countMinesAround(r, c);
            cell.classList.add('open');
            if (minesAround > 0) {
                cell.innerText = minesAround;
            } else {
                // Рекурсивное открытие пустых клеток
                this.floodFill(r, c);
            }

            // Проверка на победу (если открыты все не-мины)
            if (document.querySelectorAll('.cell.open').length === (this.currentGame.width * this.currentGame.height - this.currentGame.minesLocations.length)) {
                this.currentGame.gameOver = true;
                resultStr = 'won';
                document.getElementById('game-status').innerText = "ПОБЕДА!";
            }
        }

        this.currentGame.stepCount++;

        // Отправка хода на сервер
        await this.sendStep(this.currentGame.id, {
            step_number: this.currentGame.stepCount,
            row: r,
            col: c,
            result: resultStr
        });

    },

    countMinesAround: function (r, c) {
        let count = 0;
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const nr = r + i;
                const nc = c + j;
                if (nr >= 0 && nr < this.currentGame.height && nc >= 0 && nc < this.currentGame.width) {
                    const idx = nr * this.currentGame.width + nc;
                    if (this.currentGame.minesLocations.includes(idx)) count++;
                }
            }
        }
        return count;
    },
    handleRightClick: function (e, r, c) {
        e.preventDefault(); // Запрещаем стандартное меню браузера

        if (this.currentGame.gameOver || this.currentGame.isReplay) return;

        const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);

        // Нельзя ставить флаг на уже открытую клетку
        if (cell.classList.contains('open')) return;

        if (cell.classList.contains('flag')) {
            // Если флаг уже стоит - убираем
            cell.classList.remove('flag');
            cell.innerText = '';
        } else {
            // Если флага нет - ставим
            cell.classList.add('flag');
            cell.innerText = '🚩';
        }
    },

    floodFill: function (r, c) {
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const nr = r + i;
                const nc = c + j;
                if (nr >= 0 && nr < this.currentGame.height && nc >= 0 && nc < this.currentGame.width) {
                    const cell = document.querySelector(`.cell[data-row="${nr}"][data-col="${nc}"]`);
                    if (!cell.classList.contains('open')) {
                        const mines = this.countMinesAround(nr, nc);
                        cell.classList.add('open');
                        if (mines > 0) {
                            cell.innerText = mines;
                        } else {
                            this.floodFill(nr, nc);
                        }
                    }
                }
            }
        }
    },

    revealAllMines: function () {
        this.currentGame.minesLocations.forEach(idx => {
            const r = Math.floor(idx / this.currentGame.width);
            const c = idx % this.currentGame.width;
            const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
            cell.classList.add('mine', 'open');
            cell.innerText = '💣';
        });
    },

    // --- Replay Logic ---

    loadReplay: async function (id) {
        const data = await this.getGameDetails(id);

        this.currentGame = {
            id: data.id,
            width: data.width,
            height: data.height,
            minesLocations: data.mine_locations, // С сервера приходит уже массив
            isReplay: true,
            replayMoves: data.moves,
            replayIndex: 0
        };

        this.renderGrid(data.width, data.height);
        this.showScreen('screen-game');
        document.getElementById('game-status').innerText = "Режим повтора. Нажмите 'Следующий ход'";
        document.getElementById('replay-next-btn').classList.remove('hidden');
    },

    replayNextStep: function () {
        if (this.currentGame.replayIndex >= this.currentGame.replayMoves.length) {
            alert("Реплей окончен");
            return;
        }

        const move = this.currentGame.replayMoves[this.currentGame.replayIndex];
        const cell = document.querySelector(`.cell[data-row="${move.row}"][data-col="${move.col}"]`);

        // Визуально воспроизводим логику (упрощенно)
        const idx = move.row * this.currentGame.width + move.col;
        if (this.currentGame.minesLocations.includes(idx)) {
            cell.classList.add('mine', 'open');
            cell.innerText = '💣';
            document.getElementById('game-status').innerText = "Игра окончена (взрыв)";
        } else {
            const minesAround = this.countMinesAround(move.row, move.col);
            cell.classList.add('open');
            if (minesAround > 0) cell.innerText = minesAround;
            else this.floodFill(move.row, move.col); // Воспроизводим открытие области
        }

        this.currentGame.replayIndex++;
        if (this.currentGame.replayIndex >= this.currentGame.replayMoves.length) {
            if (move.result === 'won') document.getElementById('game-status').innerText = "Игра окончена (победа)";
        }
    }
};

window.onload = () => app.init();