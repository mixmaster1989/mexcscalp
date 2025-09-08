"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramAuth = void 0;
const db_1 = require("../storage/db");
/**
 * Система авторизации для Telegram бота
 */
class TelegramAuth {
    authorizedUsers = new Map();
    adminChatIds = new Set();
    secretKey;
    constructor(secretKey, adminChatIds = []) {
        this.secretKey = secretKey;
        this.adminChatIds = new Set(adminChatIds);
    }
    /**
     * Загрузить пользователей из базы данных
     */
    async loadUsers() {
        const db = (0, db_1.getDatabase)();
        try {
            const users = await db.all(`
        SELECT chat_id, username, first_name, last_name, is_authorized, role, registered_at, last_active_at
        FROM telegram_users
        WHERE is_authorized = 1
      `);
            for (const user of users) {
                this.authorizedUsers.set(user.chat_id, {
                    chatId: user.chat_id,
                    username: user.username,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    isAuthorized: Boolean(user.is_authorized),
                    role: user.role,
                    registeredAt: user.registered_at,
                    lastActiveAt: user.last_active_at
                });
                if (user.role === 'admin') {
                    this.adminChatIds.add(user.chat_id);
                }
            }
        }
        catch (error) {
            console.error('Ошибка загрузки пользователей:', error);
        }
    }
    /**
     * Сохранить пользователя в базу данных
     */
    async saveUser(user) {
        const db = (0, db_1.getDatabase)();
        try {
            await db.run(`
        INSERT OR REPLACE INTO telegram_users 
        (chat_id, username, first_name, last_name, is_authorized, role, registered_at, last_active_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
                user.chatId,
                user.username || null,
                user.firstName || null,
                user.lastName || null,
                user.isAuthorized ? 1 : 0,
                user.role,
                user.registeredAt,
                user.lastActiveAt
            ]);
        }
        catch (error) {
            console.error('Ошибка сохранения пользователя:', error);
        }
    }
    /**
     * Проверить авторизацию пользователя
     */
    isAuthorized(chatId) {
        const user = this.authorizedUsers.get(chatId);
        return user ? user.isAuthorized : false;
    }
    /**
     * Проверить права администратора
     */
    isAdmin(chatId) {
        const user = this.authorizedUsers.get(chatId);
        return user ? user.role === 'admin' : false;
    }
    /**
     * Авторизовать пользователя по секретному ключу
     */
    async authorize(chatId, username, firstName, lastName, providedKey, role = 'viewer') {
        // Проверяем секретный ключ
        if (providedKey !== this.secretKey) {
            return { success: false, message: '❌ Неверный ключ доступа' };
        }
        // Создаем пользователя
        const user = {
            chatId,
            username,
            firstName,
            lastName,
            isAuthorized: true,
            role,
            registeredAt: Date.now(),
            lastActiveAt: Date.now()
        };
        // Сохраняем в память и базу данных
        this.authorizedUsers.set(chatId, user);
        await this.saveUser(user);
        if (role === 'admin') {
            this.adminChatIds.add(chatId);
        }
        return {
            success: true,
            message: `✅ Авторизация успешна! Роль: ${role === 'admin' ? 'Администратор' : 'Наблюдатель'}`
        };
    }
    /**
     * Отозвать авторизацию
     */
    async revokeAuthorization(chatId) {
        const user = this.authorizedUsers.get(chatId);
        if (user) {
            user.isAuthorized = false;
            await this.saveUser(user);
            this.authorizedUsers.delete(chatId);
            this.adminChatIds.delete(chatId);
        }
    }
    /**
     * Обновить время последней активности
     */
    async updateLastActive(chatId) {
        const user = this.authorizedUsers.get(chatId);
        if (user) {
            user.lastActiveAt = Date.now();
            await this.saveUser(user);
        }
    }
    /**
     * Получить информацию о пользователе
     */
    getUser(chatId) {
        return this.authorizedUsers.get(chatId);
    }
    /**
     * Получить всех авторизованных пользователей
     */
    getAuthorizedUsers() {
        return Array.from(this.authorizedUsers.values()).filter(user => user.isAuthorized);
    }
    /**
     * Получить всех администраторов
     */
    getAdmins() {
        return Array.from(this.authorizedUsers.values()).filter(user => user.isAuthorized && user.role === 'admin');
    }
    /**
     * Получить ID чатов для уведомлений
     */
    getNotificationChatIds(priority = 'low') {
        const users = this.getAuthorizedUsers();
        // Критические уведомления только админам
        if (priority === 'critical') {
            return this.getAdmins().map(user => user.chatId);
        }
        // Высокий приоритет - админам и активным пользователям
        if (priority === 'high') {
            const activeThreshold = Date.now() - (24 * 60 * 60 * 1000); // 24 часа
            return users
                .filter(user => user.role === 'admin' || user.lastActiveAt > activeThreshold)
                .map(user => user.chatId);
        }
        // Средний и низкий приоритет - всем авторизованным
        return users.map(user => user.chatId);
    }
    /**
     * Инициализировать таблицы в базе данных
     */
    async initDatabase() {
        const db = (0, db_1.getDatabase)();
        try {
            await db.run(`
        CREATE TABLE IF NOT EXISTS telegram_users (
          chat_id INTEGER PRIMARY KEY,
          username TEXT,
          first_name TEXT,
          last_name TEXT,
          is_authorized INTEGER NOT NULL DEFAULT 0,
          role TEXT NOT NULL DEFAULT 'viewer',
          registered_at INTEGER NOT NULL,
          last_active_at INTEGER NOT NULL
        )
      `);
            await db.run(`
        CREATE INDEX IF NOT EXISTS idx_telegram_users_authorized 
        ON telegram_users (is_authorized)
      `);
            await db.run(`
        CREATE INDEX IF NOT EXISTS idx_telegram_users_role 
        ON telegram_users (role)
      `);
        }
        catch (error) {
            console.error('Ошибка инициализации таблиц Telegram:', error);
            throw error;
        }
    }
    /**
     * Очистить неактивных пользователей
     */
    async cleanupInactiveUsers(daysInactive = 30) {
        const cutoffTime = Date.now() - (daysInactive * 24 * 60 * 60 * 1000);
        const db = (0, db_1.getDatabase)();
        try {
            const result = await db.run(`
        DELETE FROM telegram_users 
        WHERE last_active_at < ? AND role != 'admin'
      `, [cutoffTime]);
            // Также удаляем из памяти
            for (const [chatId, user] of this.authorizedUsers) {
                if (user.lastActiveAt < cutoffTime && user.role !== 'admin') {
                    this.authorizedUsers.delete(chatId);
                }
            }
            return result.changes || 0;
        }
        catch (error) {
            console.error('Ошибка очистки неактивных пользователей:', error);
            return 0;
        }
    }
}
exports.TelegramAuth = TelegramAuth;
//# sourceMappingURL=auth.js.map