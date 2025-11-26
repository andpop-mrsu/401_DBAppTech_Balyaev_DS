<?php
// Front Controller

// 1. Настройка окружения
// Если запрос идет к существующему файлу (css, js, html), отдаем его как есть
if (file_exists(__DIR__ . $_SERVER['REQUEST_URI']) && $_SERVER['REQUEST_URI'] !== '/') {
    return false; 
}

// Настройка заголовков для JSON API
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Обработка preflight запросов (OPTIONS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Подключение к БД (создаст файл, если его нет)
$dbDir = __DIR__ . '/../db';
if (!is_dir($dbDir)) mkdir($dbDir);
$dbFile = $dbDir . '/database.sqlite';

try {
    $pdo = new PDO("sqlite:$dbFile");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // 2. Инициализация таблиц (если их нет)
    $pdo->exec("CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        player_name TEXT,
        width INTEGER,
        height INTEGER,
        mines_count INTEGER,
        mine_locations TEXT, 
        status TEXT
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS moves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER,
        step_number INTEGER,
        row INTEGER,
        col INTEGER,
        result TEXT,
        FOREIGN KEY(game_id) REFERENCES games(id)
    )");

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit();
}

// 3. Маршрутизация (Routing)
$method = $_SERVER['REQUEST_METHOD'];
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$pathParts = explode('/', trim($uri, '/'));

// Если корень - отдаем index.html
if ($uri === '/' || $uri === '/index.html') {
    readfile(__DIR__ . '/index.html');
    exit();
}

// API Маршруты
$resource = $pathParts[0] ?? null;
$param = $pathParts[1] ?? null;

header('Content-Type: application/json');

// GET /games - Список игр
if ($method === 'GET' && $resource === 'games' && !$param) {
    $stmt = $pdo->query("SELECT * FROM games ORDER BY id DESC");
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    exit();
}

// GET /games/{id} - Детали игры и ходы
if ($method === 'GET' && $resource === 'games' && $param) {
    $stmtGame = $pdo->prepare("SELECT * FROM games WHERE id = ?");
    $stmtGame->execute([$param]);
    $game = $stmtGame->fetch(PDO::FETCH_ASSOC);

    if ($game) {
        $stmtMoves = $pdo->prepare("SELECT * FROM moves WHERE game_id = ? ORDER BY step_number ASC");
        $stmtMoves->execute([$param]);
        $game['moves'] = $stmtMoves->fetchAll(PDO::FETCH_ASSOC);
        
        // Декодируем расположение мин из JSON строки обратно в массив
        $game['mine_locations'] = json_decode($game['mine_locations']);
        echo json_encode($game);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Game not found']);
    }
    exit();
}

// POST /games - Новая игра
if ($method === 'POST' && $resource === 'games') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!$data) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON']);
        exit();
    }

    $stmt = $pdo->prepare("INSERT INTO games (date, player_name, width, height, mines_count, mine_locations, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
    
    $date = date('Y-m-d H:i:s');
    // mine_locations храним как JSON-строку в БД
    $minesJson = json_encode($data['mine_locations']); 
    
    $stmt->execute([
        $date, 
        $data['player_name'], 
        $data['width'], 
        $data['height'], 
        $data['mines_count'], 
        $minesJson,
        'playing'
    ]);

    echo json_encode(['id' => $pdo->lastInsertId()]);
    exit();
}

// POST /step/{id} - Запись хода
if ($method === 'POST' && $resource === 'step' && $param) {
    $data = json_decode(file_get_contents('php://input'), true);
    $gameId = $param;

    // Записываем ход
    $stmt = $pdo->prepare("INSERT INTO moves (game_id, step_number, row, col, result) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([
        $gameId,
        $data['step_number'],
        $data['row'],
        $data['col'],
        $data['result']
    ]);

    // Если игра закончилась (выиграл или взорвался), обновляем статус игры
    if ($data['result'] === 'exploded' || $data['result'] === 'won') {
        $status = ($data['result'] === 'won') ? 'won' : 'lost';
        $stmtUpdate = $pdo->prepare("UPDATE games SET status = ? WHERE id = ?");
        $stmtUpdate->execute([$status, $gameId]);
    }

    echo json_encode(['status' => 'ok']);
    exit();
}

// 404 Not Found
http_response_code(404);
echo json_encode(['error' => 'Endpoint not found']);