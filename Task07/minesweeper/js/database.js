class Database {
    constructor() {
        this.db = null;
        this.dbName = 'MinesweeperDB';
        this.dbVersion = 1;
    }

    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Таблица для игр
                if (!db.objectStoreNames.contains('games')) {
                    const gamesStore = db.createObjectStore('games', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    gamesStore.createIndex('date', 'date', { unique: false });
                    gamesStore.createIndex('player', 'player', { unique: false });
                }

                // Таблица для ходов
                if (!db.objectStoreNames.contains('moves')) {
                    const movesStore = db.createObjectStore('moves', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    movesStore.createIndex('gameId', 'gameId', { unique: false });
                    movesStore.createIndex('moveNumber', 'moveNumber', { unique: false });
                }
            };
        });
    }

    saveGame(gameData) {
        const transaction = this.db.transaction(['games', 'moves'], 'readwrite');
        const gamesStore = transaction.objectStore('games');
        const movesStore = transaction.objectStore('moves');

        return new Promise((resolve, reject) => {
            // Сохраняем игру
            const gameRequest = gamesStore.add({
                date: new Date().toISOString(),
                player: gameData.player,
                size: gameData.size,
                mines: gameData.mines,
                minePositions: gameData.minePositions,
                status: gameData.status,
                movesCount: gameData.moves.length
            });

            gameRequest.onsuccess = (event) => {
                const gameId = event.target.result;
                
                // Сохраняем ходы
                gameData.moves.forEach((move, index) => {
                    movesStore.add({
                        gameId: gameId,
                        moveNumber: index + 1,
                        x: move.x,
                        y: move.y,
                        result: move.result
                    });
                });

                resolve(gameId);
            };

            gameRequest.onerror = () => reject(gameRequest.error);
        });
    }

    getAllGames() {
        const transaction = this.db.transaction(['games'], 'readonly');
        const store = transaction.objectStore('games');
        const index = store.index('date');

        return new Promise((resolve, reject) => {
            const request = index.openCursor(null, 'prev'); // сортируем от новых к старым
            const games = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    games.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(games);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    getGameMoves(gameId) {
        const transaction = this.db.transaction(['moves'], 'readonly');
        const store = transaction.objectStore('moves');
        const index = store.index('gameId');

        return new Promise((resolve, reject) => {
            const request = index.getAll(Number(gameId));
            request.onsuccess = () => {
                const moves = request.result.sort((a, b) => a.moveNumber - b.moveNumber);
                resolve(moves);
            };
            request.onerror = () => reject(request.error);
        });
    }

    getGameById(gameId) {
        const transaction = this.db.transaction(['games'], 'readonly');
        const store = transaction.objectStore('games');

        return new Promise((resolve, reject) => {
            const request = store.get(Number(gameId));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}