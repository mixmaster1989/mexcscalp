import sqlite3 from 'sqlite3';
/**
 * SQLite база данных для торговой системы
 */
export declare class Database {
    private db;
    private dbPath;
    constructor(dbPath?: string);
    /**
     * Подключиться к базе данных
     */
    connect(): Promise<void>;
    /**
     * Отключиться от базы данных
     */
    disconnect(): Promise<void>;
    /**
     * Выполнить SQL запрос
     */
    run(sql: string, params?: any[]): Promise<sqlite3.RunResult>;
    /**
     * Получить одну запись
     */
    get(sql: string, params?: any[]): Promise<any>;
    /**
     * Получить все записи
     */
    all(sql: string, params?: any[]): Promise<any[]>;
    /**
     * Инициализировать таблицы
     */
    initTables(): Promise<void>;
    /**
     * Начать транзакцию
     */
    beginTransaction(): Promise<void>;
    /**
     * Зафиксировать транзакцию
     */
    commit(): Promise<void>;
    /**
     * Откатить транзакцию
     */
    rollback(): Promise<void>;
    /**
     * Выполнить функцию в транзакции
     */
    transaction<T>(fn: () => Promise<T>): Promise<T>;
    /**
     * Очистить старые записи
     */
    cleanup(olderThanDays?: number): Promise<void>;
    /**
     * Получить статистику базы данных
     */
    getStats(): Promise<{
        events: number;
        orders: number;
        fills: number;
        positions: number;
        trades: number;
    }>;
}
/**
 * Получить экземпляр базы данных
 */
export declare function getDatabase(dbPath?: string): Database;
/**
 * Инициализировать базу данных
 */
export declare function initDatabase(dbPath?: string): Promise<Database>;
//# sourceMappingURL=db.d.ts.map