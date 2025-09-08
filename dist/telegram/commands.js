"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramCommands = void 0;
/**
 * Обработчики команд Telegram бота
 */
class TelegramCommands {
    auth;
    getTradingStats;
    getSystemStatus;
    onTradingCommand;
    constructor(auth, getTradingStats, getSystemStatus, onTradingCommand) {
        this.auth = auth;
        this.getTradingStats = getTradingStats;
        this.getSystemStatus = getSystemStatus;
        this.onTradingCommand = onTradingCommand;
    }
    /**
     * Обработать команду /start
     */
    async handleStart(bot, chatId, username, firstName, lastName) {
        const user = this.auth.getUser(chatId);
        if (user && user.isAuthorized) {
            await this.auth.updateLastActive(chatId);
            const welcomeMessage = `
🤖 *MEXC Scalp Bot* - Добро пожаловать!

👋 Привет, ${firstName || username || 'пользователь'}!
🔐 Вы авторизованы как: *${user.role === 'admin' ? 'Администратор' : 'Наблюдатель'}*

📊 Доступные команды:
/status - Статус системы
/stats - Торговая статистика  
/help - Помощь по командам

${user.role === 'admin' ? `
🛠 *Команды администратора:*
/start_trading - Запустить торговлю
/stop_trading - Остановить торговлю
/pause_trading - Приостановить торговлю
/emergency_stop - Аварийная остановка
` : ''}

Используйте кнопки ниже для быстрого доступа 👇
      `;
            const keyboard = this.getMainKeyboard(user.role === 'admin');
            await bot.sendMessage(chatId, welcomeMessage, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        }
        else {
            const authMessage = `
🔐 *Авторизация требуется*

Для доступа к боту введите команду:
\`/auth ВАШ_СЕКРЕТНЫЙ_КЛЮЧ\`

🔒 Ключ можно получить у администратора системы.
      `;
            await bot.sendMessage(chatId, authMessage, { parse_mode: 'Markdown' });
        }
    }
    /**
     * Обработать команду /auth
     */
    async handleAuth(bot, chatId, key, username, firstName, lastName) {
        const result = await this.auth.authorize(chatId, username, firstName, lastName, key);
        await bot.sendMessage(chatId, result.message, { parse_mode: 'Markdown' });
        if (result.success) {
            // Показываем главное меню после успешной авторизации
            setTimeout(() => {
                this.handleStart(bot, chatId, username, firstName, lastName);
            }, 1000);
        }
    }
    /**
     * Обработать команду /status
     */
    async handleStatus(bot, chatId) {
        if (!this.auth.isAuthorized(chatId)) {
            await bot.sendMessage(chatId, '❌ Доступ запрещен. Используйте /auth для авторизации.');
            return;
        }
        await this.auth.updateLastActive(chatId);
        try {
            const status = this.getSystemStatus();
            const statusMessage = `
🤖 *Статус системы MEXC Scalp Bot*

*🔧 Бот:*
${this.getStatusIcon(status.bot.status)} Статус: \`${status.bot.status}\`
⏰ Время работы: ${this.formatUptime(status.bot.uptime)}
📦 Версия: \`${status.bot.version}\`

*📈 Торговля:*
${this.getStatusIcon(status.trading.status)} Статус: \`${status.trading.status}\`
🎯 Режим рынка: \`${status.trading.regime}\`
🕐 Последнее обновление: ${this.formatTime(status.trading.lastUpdate)}

*🔌 API подключения:*
${status.api.rest ? '✅' : '❌'} REST API
${status.api.websocket ? '✅' : '❌'} WebSocket
🕐 Последняя проверка: ${this.formatTime(status.api.lastCheck)}

*💾 База данных:*
${status.database.connected ? '✅' : '❌'} Подключение
🗄 Последний бэкап: ${this.formatTime(status.database.lastBackup)}
      `;
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '🔄 Обновить', callback_data: 'refresh_status' },
                        { text: '📊 Статистика', callback_data: 'show_stats' }
                    ],
                    [
                        { text: '🏠 Главное меню', callback_data: 'main_menu' }
                    ]
                ]
            };
            await bot.sendMessage(chatId, statusMessage, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        }
        catch (error) {
            await bot.sendMessage(chatId, `❌ Ошибка получения статуса: ${error}`);
        }
    }
    /**
     * Обработать команду /stats
     */
    async handleStats(bot, chatId) {
        if (!this.auth.isAuthorized(chatId)) {
            await bot.sendMessage(chatId, '❌ Доступ запрещен. Используйте /auth для авторизации.');
            return;
        }
        await this.auth.updateLastActive(chatId);
        try {
            const stats = this.getTradingStats();
            const statsMessage = `
📊 *Торговая статистика*

*🎯 Текущее состояние:*
${stats.isActive ? '✅' : '❌'} Торговля: \`${stats.isActive ? 'Активна' : 'Остановлена'}\`
🌡 Режим рынка: \`${stats.currentRegime}\`
📈 Цена: \`$${stats.midPrice.toFixed(2)}\`

*📋 Активные ордера:*
🎪 Уровни Ёршиков: \`${stats.activeLevels}\`
🎯 Take Profit ордера: \`${stats.activeTPs}\`

*💰 Позиция:*
📦 Инвентарь: \`${stats.inventory.toFixed(6)} ETH\`
💵 Notional: \`$${stats.inventoryNotional.toFixed(2)}\`

*📈 Результаты:*
💹 P&L сегодня: \`$${stats.pnlToday.toFixed(2)}\`
🎲 Сделок: \`${stats.tradesCount}\`
🏆 Win Rate: \`${(stats.winRate * 100).toFixed(1)}%\`
      `;
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '🔄 Обновить', callback_data: 'refresh_stats' },
                        { text: '📋 Детали', callback_data: 'detailed_stats' }
                    ],
                    [
                        { text: '📊 Статус', callback_data: 'show_status' },
                        { text: '🏠 Главное меню', callback_data: 'main_menu' }
                    ]
                ]
            };
            await bot.sendMessage(chatId, statsMessage, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        }
        catch (error) {
            await bot.sendMessage(chatId, `❌ Ошибка получения статистики: ${error}`);
        }
    }
    /**
     * Обработать команды торговли (только для админов)
     */
    async handleTradingCommand(bot, chatId, command) {
        if (!this.auth.isAdmin(chatId)) {
            await bot.sendMessage(chatId, '❌ Доступ запрещен. Требуются права администратора.');
            return;
        }
        await this.auth.updateLastActive(chatId);
        try {
            const result = await this.onTradingCommand(command, chatId);
            await bot.sendMessage(chatId, result, { parse_mode: 'Markdown' });
        }
        catch (error) {
            await bot.sendMessage(chatId, `❌ Ошибка выполнения команды: ${error}`);
        }
    }
    /**
     * Обработать команду /help
     */
    async handleHelp(bot, chatId) {
        if (!this.auth.isAuthorized(chatId)) {
            await bot.sendMessage(chatId, '❌ Доступ запрещен. Используйте /auth для авторизации.');
            return;
        }
        const user = this.auth.getUser(chatId);
        const isAdmin = user?.role === 'admin';
        const helpMessage = `
📚 *Справка по командам*

*🔐 Базовые команды:*
/start - Главное меню
/status - Статус системы  
/stats - Торговая статистика
/help - Эта справка

${isAdmin ? `
*🛠 Команды администратора:*
/start_trading - Запустить торговлю
/stop_trading - Остановить торговлю  
/pause_trading - Приостановить торговлю
/emergency_stop - Аварийная остановка с отменой всех ордеров

*⚙️ Управление:*
/users - Список пользователей
/revoke <chat_id> - Отозвать доступ пользователя
/backup - Создать резервную копию БД
` : ''}

*🔔 Уведомления:*
• Сделки и исполнения ордеров
• Изменения режима рынка
• Системные ошибки и предупреждения
• Критические события

*💡 Советы:*
• Используйте кнопки для быстрого доступа
• Следите за уведомлениями
• При проблемах обращайтесь к администратору
    `;
        await bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
    }
    /**
     * Получить главную клавиатуру
     */
    getMainKeyboard(isAdmin) {
        const keyboard = [
            [
                { text: '📊 Статус', callback_data: 'show_status' },
                { text: '📈 Статистика', callback_data: 'show_stats' }
            ]
        ];
        if (isAdmin) {
            keyboard.push([
                { text: '▶️ Старт', callback_data: 'start_trading' },
                { text: '⏸ Пауза', callback_data: 'pause_trading' },
                { text: '⏹ Стоп', callback_data: 'stop_trading' }
            ]);
            keyboard.push([
                { text: '🚨 Аварийный стоп', callback_data: 'emergency_stop' }
            ]);
        }
        keyboard.push([
            { text: '❓ Помощь', callback_data: 'show_help' }
        ]);
        return { inline_keyboard: keyboard };
    }
    /**
     * Получить иконку статуса
     */
    getStatusIcon(status) {
        switch (status) {
            case 'running':
            case 'active':
                return '✅';
            case 'stopped':
            case 'paused':
                return '⏸';
            case 'error':
                return '❌';
            default:
                return '⚪';
        }
    }
    /**
     * Форматировать время работы
     */
    formatUptime(uptimeMs) {
        const seconds = Math.floor(uptimeMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0) {
            return `${days}д ${hours % 24}ч ${minutes % 60}м`;
        }
        else if (hours > 0) {
            return `${hours}ч ${minutes % 60}м`;
        }
        else {
            return `${minutes}м ${seconds % 60}с`;
        }
    }
    /**
     * Форматировать время
     */
    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('ru-RU', {
            timeZone: 'Europe/Moscow',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}
exports.TelegramCommands = TelegramCommands;
//# sourceMappingURL=commands.js.map