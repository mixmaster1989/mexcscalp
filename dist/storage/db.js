"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Database = void 0;
exports.getDatabase = getDatabase;
exports.initDatabase = initDatabase;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
/**
 * SQLite база данных для торговой системы
 */
class Database {
    db = null;
    dbPath;
    constructor(dbPath = './data/mexc_bot.db') {
        this.dbPath = dbPath;
    }
    /**
     * Подключиться к базе данных
     */
    async connect() {
        // Создаем директорию если не существует
        const dir = path_1.default.dirname(this.dbPath);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        return new Promise((resolve, reject) => {
            this.db = new sqlite3_1.default.Database(this.dbPath, (error) => {
                if (error) {
                    reject(new Error(`Ошибка подключения к базе данных: ${error.message}`));
                }
                else {
                    resolve();
                }
            });
        });
    }
    /**
     * Отключиться от базы данных
     */
    async disconnect() {
        if (!this.db)
            return;
        return new Promise((resolve, reject) => {
            this.db.close((error) => {
                if (error) {
                    reject(new Error(`Ошибка закрытия базы данных: ${error.message}`));
                }
                else {
                    this.db = null;
                    resolve();
                }
            });
        });
    }
    /**
     * Выполнить SQL запрос
     */
    async run(sql, params = []) {
        if (!this.db) {
            throw new Error('База данных не подключена');
        }
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (error) {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(this);
                }
            });
        });
    }
    /**
     * Получить одну запись
     */
    async get(sql, params = []) {
        if (!this.db) {
            throw new Error('База данных не подключена');
        }
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (error, row) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(row);
                }
            });
        });
    }
    /**
     * Получить все записи
     */
    async all(sql, params = []) {
        if (!this.db) {
            throw new Error('База данных не подключена');
        }
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (error, rows) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(rows || []);
                }
            });
        });
    }
    /**
     * Инициализировать таблицы
     */
    async initTables() {
        const tables = [
            // Таблица событий системы
            `CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL
      )`,
            // Таблица ордеров
            `CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        status TEXT NOT NULL,
        side TEXT NOT NULL,
        price REAL NOT NULL,
        qty REAL NOT NULL,
        filled REAL DEFAULT 0,
        ts_open INTEGER NOT NULL,
        ts_close INTEGER,
        symbol TEXT NOT NULL,
        type TEXT NOT NULL,
        strategy TEXT,
        level INTEGER
      )`,
            // Таблица исполнений (fills)
            `CREATE TABLE IF NOT EXISTS fills (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        price REAL NOT NULL,
        qty REAL NOT NULL,
        fee REAL NOT NULL,
        ts INTEGER NOT NULL,
        side TEXT NOT NULL,
        symbol TEXT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders (id)
      )`,
            // Таблица позиций
            `CREATE TABLE IF NOT EXISTS positions (
        symbol TEXT PRIMARY KEY,
        qty REAL NOT NULL,
        avg_entry REAL NOT NULL,
        ts_updated INTEGER NOT NULL,
        unrealized_pnl REAL DEFAULT 0
      )`,
            // Таблица завершенных сделок
            `CREATE TABLE IF NOT EXISTS trades (
        trade_id TEXT PRIMARY KEY,
        side TEXT NOT NULL,
        entry REAL NOT NULL,
        exit REAL NOT NULL,
        qty REAL NOT NULL,
        pnl REAL NOT NULL,
        mae REAL NOT NULL,
        mfe REAL NOT NULL,
        duration_ms INTEGER NOT NULL,
        regime TEXT NOT NULL,
        strategy TEXT NOT NULL,
        symbol TEXT NOT NULL,
        ts_entry INTEGER NOT NULL,
        ts_exit INTEGER NOT NULL
      )`
        ];
        for (const tableSQL of tables) {
            await this.run(tableSQL);
        }
        // Создаем индексы для оптимизации запросов
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_events_ts ON events (ts)',
            'CREATE INDEX IF NOT EXISTS idx_events_type ON events (type)',
            'CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders (client_id)',
            'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status)',
            'CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders (symbol)',
            'CREATE INDEX IF NOT EXISTS idx_orders_ts_open ON orders (ts_open)',
            'CREATE INDEX IF NOT EXISTS idx_fills_order_id ON fills (order_id)',
            'CREATE INDEX IF NOT EXISTS idx_fills_ts ON fills (ts)',
            'CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades (symbol)',
            'CREATE INDEX IF NOT EXISTS idx_trades_ts_entry ON trades (ts_entry)',
            'CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades (strategy)'
        ];
        for (const indexSQL of indexes) {
            await this.run(indexSQL);
        }
    }
    /**
     * Начать транзакцию
     */
    async beginTransaction() {
        await this.run('BEGIN TRANSACTION');
    }
    /**
     * Зафиксировать транзакцию
     */
    async commit() {
        await this.run('COMMIT');
    }
    /**
     * Откатить транзакцию
     */
    async rollback() {
        await this.run('ROLLBACK');
    }
    /**
     * Выполнить функцию в транзакции
     */
    async transaction(fn) {
        await this.beginTransaction();
        try {
            const result = await fn();
            await this.commit();
            return result;
        }
        catch (error) {
            await this.rollback();
            throw error;
        }
    }
    /**
     * Очистить старые записи
     */
    async cleanup(olderThanDays = 30) {
        const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
        await this.run('DELETE FROM events WHERE ts < ?', [cutoffTime]);
        await this.run('DELETE FROM fills WHERE ts < ?', [cutoffTime]);
        await this.run('DELETE FROM orders WHERE ts_open < ? AND status IN ("FILLED", "CANCELED", "REJECTED")', [cutoffTime]);
        await this.run('DELETE FROM trades WHERE ts_entry < ?', [cutoffTime]);
    }
    /**
     * Получить статистику базы данных
     */
    async getStats() {
        const [events, orders, fills, positions, trades] = await Promise.all([
            this.get('SELECT COUNT(*) as count FROM events'),
            this.get('SELECT COUNT(*) as count FROM orders'),
            this.get('SELECT COUNT(*) as count FROM fills'),
            this.get('SELECT COUNT(*) as count FROM positions'),
            this.get('SELECT COUNT(*) as count FROM trades')
        ]);
        return {
            events: events.count,
            orders: orders.count,
            fills: fills.count,
            positions: positions.count,
            trades: trades.count
        };
    }
}
exports.Database = Database;
// Глобальный экземпляр базы данных
let dbInstance = null;
/**
 * Получить экземпляр базы данных
 */
function getDatabase(dbPath) {
    if (!dbInstance) {
        dbInstance = new Database(dbPath);
    }
    return dbInstance;
}
/**
 * Инициализировать базу данных
 */
async function initDatabase(dbPath) {
    const db = getDatabase(dbPath);
    await db.connect();
    await db.initTables();
    return db;
}
//# sourceMappingURL=db.js.map