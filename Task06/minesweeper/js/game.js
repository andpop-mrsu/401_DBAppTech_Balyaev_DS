class MinesweeperGame {
    constructor(size, minesCount, playerName) {
        this.size = size;
        this.minesCount = minesCount;
        this.playerName = playerName;
        this.board = [];
        this.minePositions = [];
        this.revealedCells = new Set();
        this.flaggedCells = new Set();
        this.gameOver = false;
        this.gameWon = false;
        this.moveCount = 0;
        this.startTime = null;
        
        this.initializeBoard();
        this.placeMines();
        this.calculateNumbers();
    }

    initializeBoard() {
        this.board = [];
        for (let i = 0; i < this.size; i++) {
            this.board[i] = [];
            for (let j = 0; j < this.size; j++) {
                this.board[i][j] = {
                    isMine: false,
                    number: 0,
                    revealed: false,
                    flagged: false
                };
            }
        }
    }

    placeMines() {
        this.minePositions = [];
        let minesPlaced = 0;

        while (minesPlaced < this.minesCount) {
            const x = Math.floor(Math.random() * this.size);
            const y = Math.floor(Math.random() * this.size);

            if (!this.board[x][y].isMine) {
                this.board[x][y].isMine = true;
                this.minePositions.push({x, y});
                minesPlaced++;
            }
        }
    }

    calculateNumbers() {
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                if (!this.board[x][y].isMine) {
                    this.board[x][y].number = this.countAdjacentMines(x, y);
                }
            }
        }
    }

    countAdjacentMines(x, y) {
        let count = 0;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                
                const newX = x + dx;
                const newY = y + dy;
                
                if (this.isValidPosition(newX, newY) && this.board[newX][newY].isMine) {
                    count++;
                }
            }
        }
        return count;
    }

    isValidPosition(x, y) {
        return x >= 0 && x < this.size && y >= 0 && y < this.size;
    }

    revealCell(x, y) {
        if (this.gameOver || this.gameWon) return false;
        if (!this.isValidPosition(x, y)) return false;
        if (this.board[x][y].revealed || this.board[x][y].flagged) return false;

        if (this.moveCount === 0) {
            this.startTime = new Date();
        }

        this.moveCount++;
        this.board[x][y].revealed = true;
        this.revealedCells.add(`${x},${y}`);

        if (this.board[x][y].isMine) {
            this.gameOver = true;
            this.revealAllMines();
            return 'mine';
        }

        if (this.board[x][y].number === 0) {
            this.revealAdjacentCells(x, y);
        }

        this.checkWinCondition();

        if (this.gameWon) {
            this.gameOver = true;
            return 'win';
        }

        return 'safe';
    }

    revealAdjacentCells(x, y) {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                
                const newX = x + dx;
                const newY = y + dy;
                
                if (this.isValidPosition(newX, newY) && 
                    !this.board[newX][newY].revealed && 
                    !this.board[newX][newY].flagged &&
                    !this.board[newX][newY].isMine) {
                    
                    this.board[newX][newY].revealed = true;
                    this.revealedCells.add(`${newX},${newY}`);
                    
                    if (this.board[newX][newY].number === 0) {
                        this.revealAdjacentCells(newX, newY);
                    }
                }
            }
        }
    }

    toggleFlag(x, y) {
        if (this.gameOver || this.gameWon) return false;
        if (!this.isValidPosition(x, y)) return false;
        if (this.board[x][y].revealed) return false;

        const cellKey = `${x},${y}`;
        
        if (this.flaggedCells.has(cellKey)) {
            this.flaggedCells.delete(cellKey);
            this.board[x][y].flagged = false;
            return 'remove';
        } else {
            this.flaggedCells.add(cellKey);
            this.board[x][y].flagged = true;
            return 'add';
        }
    }

    revealAllMines() {
        for (const pos of this.minePositions) {
            this.board[pos.x][pos.y].revealed = true;
        }
    }

    checkWinCondition() {
        const totalCells = this.size * this.size;
        const nonMineCells = totalCells - this.minesCount;
        
        if (this.revealedCells.size === nonMineCells) {
            this.gameWon = true;
        }
    }

    getFlagCount() {
        return this.flaggedCells.size;
    }

    getRemainingMines() {
        return this.minesCount - this.flaggedCells.size;
    }
}