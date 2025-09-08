"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramNotifications = void 0;
/**
 * Система уведомлений Telegram бота
 */
class TelegramNotifications {
    bot;
    auth;
    isEnabled = true;
    messageQueue = [];
    sendingInProgress = false;
    constructor(bot, auth) {
        this.bot = bot;
        this.auth = auth;
        // Запускаем обработчик очереди сообщений
        this.startMessageProcessor();
    }
    /**
     * Отправить уведомление
     */
    async sendNotification(notification) {
        if (!this.isEnabled) {
            return;
        }
        const chatIds = this.auth.getNotificationChatIds(notification.priority);
        if (chatIds.length === 0) {
            return;
        }
        const message = this.formatNotification(notification);
        const options = this.getMessageOptions(notification);
        // Добавляем сообщения в очередь
        for (const chatId of chatIds) {
            this.messageQueue.push({ chatId, message, options });
        }
    }
    /**
     * Уведомление о сделке
     */
    async notifyTrade(fill) {
        const sideIcon = fill.side === 'buy' ? '🟢' : '🔴';
        const title = `${sideIcon} Сделка ${fill.side.toUpperCase()}`;
        const message = `
*Цена:* \`$${fill.price.toFixed(4)}\`
*Количество:* \`${fill.quantity.toFixed(6)} ETH\`
*Сумма:* \`$${(fill.price * fill.quantity).toFixed(2)}\`
*Комиссия:* \`$${fill.fee.toFixed(4)}\`
*Время:* ${this.formatTime(fill.timestamp)}
    `;
        await this.sendNotification({
            type: 'trade',
            title,
            message,
            priority: 'medium',
            timestamp: Date.now(),
            data: fill
        });
    }
    /**
     * Уведомление об изменении режима рынка
     */
    async notifyRegimeChange(previous, current, confidence) {
        const regimeIcons = {
            quiet: '🌙',
            normal: '☀️',
            shock: '⚡'
        };
        const title = `${regimeIcons[current]} Изменение режима рынка`;
        const message = `
*Предыдущий:* \`${previous}\` ${regimeIcons[previous]}
*Новый:* \`${current}\` ${regimeIcons[current]}
*Уверенность:* \`${(confidence * 100).toFixed(1)}%\`
*Время:* ${this.formatTime(Date.now())}

${this.getRegimeDescription(current)}
    `;
        await this.sendNotification({
            type: 'regime_change',
            title,
            message,
            priority: current === 'shock' ? 'high' : 'medium',
            timestamp: Date.now(),
            data: { previous, current, confidence }
        });
    }
    /**
     * Уведомление об ошибке
     */
    async notifyError(error, context) {
        const title = '❌ Системная ошибка';
        const message = `
*Контекст:* \`${context}\`
*Ошибка:* \`${error.message}\`
*Время:* ${this.formatTime(Date.now())}

⚠️ Проверьте логи для подробной информации.
    `;
        await this.sendNotification({
            type: 'error',
            title,
            message,
            priority: 'high',
            timestamp: Date.now(),
            data: { error: error.message, context }
        });
    }
    /**
     * Критическое уведомление (kill-switch, emergency stop)
     */
    async notifyCritical(title, message, data) {
        await this.sendNotification({
            type: 'alert',
            title: `🚨 ${title}`,
            message: `${message}\n\n*Время:* ${this.formatTime(Date.now())}`,
            priority: 'critical',
            timestamp: Date.now(),
            data
        });
    }
    /**
     * Системное уведомление (запуск, остановка)
     */
    async notifySystem(title, message, data) {
        await this.sendNotification({
            type: 'system',
            title: `🤖 ${title}`,
            message: `${message}\n\n*Время:* ${this.formatTime(Date.now())}`,
            priority: 'medium',
            timestamp: Date.now(),
            data
        });
    }
    /**
     * Уведомление о прибыли/убытке
     */
    async notifyPnL(pnl, totalTrades, winRate) {
        const pnlIcon = pnl >= 0 ? '💰' : '📉';
        const title = `${pnlIcon} Отчет P&L`;
        const message = `
*P&L сегодня:* \`$${pnl.toFixed(2)}\`
*Сделок:* \`${totalTrades}\`
*Win Rate:* \`${(winRate * 100).toFixed(1)}%\`
*Время:* ${this.formatTime(Date.now())}
    `;
        await this.sendNotification({
            type: 'system',
            title,
            message,
            priority: pnl < -50 ? 'high' : 'low', // Высокий приоритет при больших убытках
            timestamp: Date.now(),
            data: { pnl, totalTrades, winRate }
        });
    }
    /**
     * Уведомление о достижении лимитов
     */
    async notifyLimitReached(limitType, currentValue, maxValue) {
        const title = '⚠️ Достигнут лимит';
        const message = `
*Тип лимита:* \`${limitType}\`
*Текущее значение:* \`${currentValue}\`
*Максимальное значение:* \`${maxValue}\`
*Время:* ${this.formatTime(Date.now())}

🛑 Торговля может быть приостановлена.
    `;
        await this.sendNotification({
            type: 'alert',
            title,
            message,
            priority: 'high',
            timestamp: Date.now(),
            data: { limitType, currentValue, maxValue }
        });
    }
    /**
     * Форматировать уведомление
     */
    formatNotification(notification) {
        const priorityIcons = {
            low: '📘',
            medium: '📙',
            high: '📕',
            critical: '🚨'
        };
        const icon = priorityIcons[notification.priority];
        return `${icon} *${notification.title}*\n\n${notification.message}`;
    }
    /**
     * Получить опции сообщения
     */
    getMessageOptions(notification) {
        const options = {
            parse_mode: 'Markdown'
        };
        // Для критических уведомлений добавляем кнопки быстрого реагирования
        if (notification.priority === 'critical') {
            options.reply_markup = {
                inline_keyboard: [
                    [
                        { text: '🚨 Аварийный стоп', callback_data: 'emergency_stop' },
                        { text: '📊 Статус', callback_data: 'show_status' }
                    ]
                ]
            };
        }
        // Отключаем уведомления для низкого приоритета
        if (notification.priority === 'low') {
            options.disable_notification = true;
        }
        return options;
    }
    /**
     * Получить описание режима рынка
     */
    getRegimeDescription(regime) {
        switch (regime) {
            case 'quiet':
                return '🌙 *Тихий режим:* Низкая волатильность, узкие спреды';
            case 'normal':
                return '☀️ *Нормальный режим:* Стандартные параметры торговли';
            case 'shock':
                return '⚡ *Шоковый режим:* Высокая волатильность, осторожная торговля';
            default:
                return '';
        }
    }
    /**
     * Запустить обработчик очереди сообщений
     */
    startMessageProcessor() {
        setInterval(async () => {
            if (this.sendingInProgress || this.messageQueue.length === 0) {
                return;
            }
            this.sendingInProgress = true;
            try {
                // Отправляем по одному сообщению каждые 100ms для соблюдения rate limits
                const message = this.messageQueue.shift();
                if (message) {
                    await this.bot.sendMessage(message.chatId, message.message, message.options);
                }
            }
            catch (error) {
                console.error('Ошибка отправки Telegram сообщения:', error);
            }
            finally {
                this.sendingInProgress = false;
            }
        }, 100); // 100ms между сообщениями
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
            minute: '2-digit',
            second: '2-digit'
        });
    }
    /**
     * Включить/выключить уведомления
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
    }
    /**
     * Получить статус уведомлений
     */
    isNotificationsEnabled() {
        return this.isEnabled;
    }
    /**
     * Получить размер очереди сообщений
     */
    getQueueSize() {
        return this.messageQueue.length;
    }
    /**
     * Очистить очередь сообщений
     */
    clearQueue() {
        this.messageQueue = [];
    }
    /**
     * Отправить тестовое уведомление
     */
    async sendTestNotification(chatId) {
        const message = `
🧪 *Тестовое уведомление*

✅ Telegram бот работает корректно!
🕐 Время: ${this.formatTime(Date.now())}

Все уведомления будут приходить в этот чат.
    `;
        await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
}
exports.TelegramNotifications = TelegramNotifications;
//# sourceMappingURL=notifications.js.map