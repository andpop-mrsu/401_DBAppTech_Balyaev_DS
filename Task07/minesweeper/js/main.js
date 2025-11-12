let dbInstance = null;

document.addEventListener('DOMContentLoaded', async function() {
    try {
        const db = new Database();
        await db.init();
        dbInstance = db;
        console.log("✓ IndexedDB инициализирована");

        // Передаём экземпляр БД в UI
        window.gameUI = new GameUI(db);
    } catch (error) {
        console.error("✗ Ошибка инициализации IndexedDB:", error);
        alert("⚠️ Невозможно использовать базу данных.\nНекоторые функции (сохранение, повтор) будут недоступны.");
        
        // Всё равно создаём UI (без сохранения)
        window.gameUI = new GameUI(null);
    }
});