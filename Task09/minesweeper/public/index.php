<?php

// Task09/public/index.php

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Factory\AppFactory;
use Slim\Exception\HttpNotFoundException;

require __DIR__ . '/../vendor/autoload.php';

$app = AppFactory::create();
$app->addErrorMiddleware(true, true, true);

$app->add(function (Request $request, $handler): Response {
    $response = $handler->handle($request);
    return $response
        ->withHeader('Access-Control-Allow-Origin', '*')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        ->withHeader('Access-Control-Allow-Headers', 'Content-Type');
});

$app->options('/{routes:.+}', function (Request $request, Response $response) {
    return $response;
});

$dbDir = __DIR__ . '/../db';
if (!is_dir($dbDir)) {
    mkdir($dbDir, 0777, true);
}
$dbFile = $dbDir . '/database.sqlite';

try {
    $pdo = new PDO("sqlite:$dbFile");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Создание таблиц, если отсутствуют
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
    error_log('Database error: ' . $e->getMessage());
    exit('Database connection failed');
}

function json_response(Response $response, $data, int $status = 200): Response {
    $response->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    return $response->withStatus($status)->withHeader('Content-Type', 'application/json');
}

function json_error(Response $response, string $message, int $code = 400): Response {
    return json_response($response, ['error' => $message], $code);
}

$app->get('/', function (Request $request, Response $response) {
    $indexPath = __DIR__ . '/index.html';
    if (!file_exists($indexPath)) {
        throw new HttpNotFoundException($request);
    }
    $body = file_get_contents($indexPath);
    $response->getBody()->write($body);
    return $response->withHeader('Content-Type', 'text/html');
});

$app->get('/games', function (Request $request, Response $response) use ($pdo) {
    $stmt = $pdo->query("SELECT * FROM games ORDER BY id DESC");
    return json_response($response, $stmt->fetchAll(PDO::FETCH_ASSOC));
});

$app->get('/games/{id}', function (Request $request, Response $response, array $args) use ($pdo) {
    $id = (int) $args['id'];

    $stmtGame = $pdo->prepare("SELECT * FROM games WHERE id = ?");
    $stmtGame->execute([$id]);
    $game = $stmtGame->fetch(PDO::FETCH_ASSOC);

    if (!$game) {
        return json_error($response, 'Game not found', 404);
    }

    $stmtMoves = $pdo->prepare("SELECT * FROM moves WHERE game_id = ? ORDER BY step_number ASC");
    $stmtMoves->execute([$id]);
    $game['moves'] = $stmtMoves->fetchAll(PDO::FETCH_ASSOC);
    $game['mine_locations'] = json_decode($game['mine_locations'], true);

    return json_response($response, $game);
});

$app->post('/games', function (Request $request, Response $response) use ($pdo) {
    $data = json_decode($request->getBody()->getContents(), true);
    if (!is_array($data)) {
        return json_error($response, 'Invalid JSON', 400);
    }

    if (!isset($data['player_name'], $data['width'], $data['height'], $data['mines_count'], $data['mine_locations'])) {
        return json_error($response, 'Missing required fields', 400);
    }

    $stmt = $pdo->prepare("INSERT INTO games (date, player_name, width, height, mines_count, mine_locations, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $date = date('Y-m-d H:i:s');
    $minesJson = json_encode($data['mine_locations']);

    $stmt->execute([$date, $data['player_name'], $data['width'], $data['height'], $data['mines_count'], $minesJson, 'playing']);

    return json_response($response, ['id' => $pdo->lastInsertId()]);
});

$app->post('/step/{id}', function (Request $request, Response $response, array $args) use ($pdo) {
    $gameId = (int) $args['id'];
    $data = json_decode($request->getBody()->getContents(), true);

    if (!is_array($data) || !isset($data['step_number'], $data['row'], $data['col'], $data['result'])) {
        return json_error($response, 'Invalid step data', 400);
    }

    $stmt = $pdo->prepare("INSERT INTO moves (game_id, step_number, row, col, result) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$gameId, $data['step_number'], $data['row'], $data['col'], $data['result']]);

    if (in_array($data['result'], ['exploded', 'won'])) {
        $status = ($data['result'] === 'won') ? 'won' : 'lost';
        $updateStmt = $pdo->prepare("UPDATE games SET status = ? WHERE id = ?");
        $updateStmt->execute([$status, $gameId]);
    }

    return json_response($response, ['status' => 'ok']);
});

$app->run();