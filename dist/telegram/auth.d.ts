import { TelegramUser } from './types';
/**
 * Система авторизации для Telegram бота
 */
export declare class TelegramAuth {
    private authorizedUsers;
    private adminChatIds;
    private secretKey;
    constructor(secretKey: string, adminChatIds?: number[]);
    /**
     * Загрузить пользователей из базы данных
     */
    loadUsers(): Promise<void>;
    /**
     * Сохранить пользователя в базу данных
     */
    saveUser(user: TelegramUser): Promise<void>;
    /**
     * Проверить авторизацию пользователя
     */
    isAuthorized(chatId: number): boolean;
    /**
     * Проверить права администратора
     */
    isAdmin(chatId: number): boolean;
    /**
     * Авторизовать пользователя по секретному ключу
     */
    authorize(chatId: number, username: string | undefined, firstName: string | undefined, lastName: string | undefined, providedKey: string, role?: 'admin' | 'viewer'): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Отозвать авторизацию
     */
    revokeAuthorization(chatId: number): Promise<void>;
    /**
     * Обновить время последней активности
     */
    updateLastActive(chatId: number): Promise<void>;
    /**
     * Получить информацию о пользователе
     */
    getUser(chatId: number): TelegramUser | undefined;
    /**
     * Получить всех авторизованных пользователей
     */
    getAuthorizedUsers(): TelegramUser[];
    /**
     * Получить всех администраторов
     */
    getAdmins(): TelegramUser[];
    /**
     * Получить ID чатов для уведомлений
     */
    getNotificationChatIds(priority?: 'low' | 'medium' | 'high' | 'critical'): number[];
    /**
     * Инициализировать таблицы в базе данных
     */
    initDatabase(): Promise<void>;
    /**
     * Очистить неактивных пользователей
     */
    cleanupInactiveUsers(daysInactive?: number): Promise<number>;
}
//# sourceMappingURL=auth.d.ts.map