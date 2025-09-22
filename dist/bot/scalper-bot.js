"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScalperBot = void 0;
require("dotenv/config");
const mexcRest_1 = require("../infra/mexcRest");
const mexcWs_1 = require("../infra/mexcWs");
const scalping_1 = require("../strategies/scalping");
const manager_1 = require("../risk/manager");
const position_manager_1 = require("../trading/position-manager");
const trading_1 = require("../config/trading");
const statistics_1 = require("../utils/statistics");
const pino_1 = __importDefault(require("pino"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const notifications_1 = require("../telegram/notifications");
/**
 * Главный класс торгового бота-скальпера
 */
class ScalperBot {
    config;
    mexcRest;
    mexcWs;
    strategy;
    riskManager;
    positionManager;
    statsLogger;
    logger;
    telegram;
    isRunning = false;
    startTime = 0;
    errorCount = 0;
    lastError;
    healthCheckInterval;
    constructor(customConfig) {
        // Загружаем и валидируем конфигурацию
        this.config = { ...trading_1.defaultConfig, ...customConfig };
        const configErrors = (0, trading_1.validateConfig)(this.config);
        if (configErrors.length > 0) {
            throw new Error(`Ошибки конфигурации: ${configErrors.join(', ')}`);
        }
        // Настраиваем логгер ПЕРВЫМ
        this.setupLogger();
        // Инициализируем API клиенты
        this.mexcRest = new mexcRest_1.MexcRestClient(process.env.MEXC_API_KEY, process.env.MEXC_SECRET_KEY);
        this.mexcWs = new mexcWs_1.MexcWebSocketClient();
        // Настраиваем Telegram уведомления
        const telegramConfig = {
            botToken: process.env.TELEGRAM_BOT_TOKEN || '',
            chatId: process.env.TELEGRAM_ADMIN_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || '',
            enabled: !!(process.env.TELEGRAM_BOT_TOKEN && (process.env.TELEGRAM_ADMIN_CHAT_IDS || process.env.TELEGRAM_CHAT_ID))
        };
        this.telegram = new notifications_1.TelegramNotifications(telegramConfig, this.logger);
        // Инициализируем компоненты
        this.riskManager = new manager_1.RiskManager(this.config);
        this.positionManager = new position_manager_1.PositionManager(this.mexcRest, this.config, this.logger, this.telegram);
        this.statsLogger = new statistics_1.StatisticsLogger(this.logger);
        this.strategy = new scalping_1.ScalpingStrategy(this.config, this.mexcRest, this.mexcWs, this.riskManager, this.positionManager, this.logger, this.telegram);
        this.setupEventHandlers();
    }
    /**
     * Запустить бота
     */
    async start() {
        try {
            this.logger.info({ config: this.config }, 'Запуск ScalperBot');
            this.startTime = Date.now();
            this.isRunning = true;
            // Проверяем API соединение
            await this.validateApiConnection();
            // Подключаем WebSocket
            await this.mexcWs.connect();
            // Запускаем стратегию
            await this.strategy.start();
            // Запускаем мониторинг
            this.startHealthCheck();
            // Отправляем стартовое сообщение в Telegram
            await this.telegram.sendStartupMessage(this.config);
            this.logger.info('ScalperBot успешно запущен');
        }
        catch (error) {
            this.logger.error({ error }, 'Ошибка запуска бота');
            this.lastError = error instanceof Error ? error.message : 'Unknown error';
            this.errorCount++;
            throw error;
        }
    }
    /**
     * Остановить бота
     */
    async stop() {
        try {
            this.logger.info('Остановка ScalperBot');
            this.isRunning = false;
            // Останавливаем мониторинг
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
            }
            // Останавливаем стратегию
            await this.strategy.stop();
            // Отключаем WebSocket
            this.mexcWs.disconnect();
            // Логируем финальную статистику
            const finalStats = this.getStats();
            this.logger.info({ finalStats }, 'ScalperBot остановлен');
        }
        catch (error) {
            this.logger.error({ error }, 'Ошибка остановки бота');
            throw error;
        }
    }
    /**
     * Получить статистику бота
     */
    getStats() {
        const uptime = this.isRunning ? Date.now() - this.startTime : 0;
        const riskMetrics = this.riskManager.getMetrics();
        const positionStats = this.positionManager.getPositionStats();
        const performance = this.riskManager.getPerformanceStats();
        return {
            status: {
                isRunning: this.isRunning,
                uptime,
                version: '1.0.0',
                lastUpdate: Date.now(),
                apiConnected: true, // Проверяется в healthCheck
                wsConnected: this.mexcWs.isConnected(),
                positionsCount: positionStats.totalPositions,
                dailyPnL: riskMetrics.dailyPnL,
                totalTrades: performance.totalTrades,
                winRate: performance.winRate,
                errorCount: this.errorCount,
                lastError: this.lastError
            },
            strategy: this.strategy.getStrategyStats(),
            risk: riskMetrics,
            positions: positionStats,
            performance
        };
    }
    /**
     * Получить краткий отчет
     */
    getQuickReport() {
        const stats = this.getStats();
        const status = stats.status;
        const performance = stats.performance;
        const uptimeHours = Math.floor(status.uptime / (1000 * 60 * 60));
        const uptimeMinutes = Math.floor((status.uptime % (1000 * 60 * 60)) / (1000 * 60));
        return `
📊 ScalperBot Отчет:
├─ Статус: ${status.isRunning ? '🟢 Активен' : '🔴 Остановлен'}
├─ Время работы: ${uptimeHours}ч ${uptimeMinutes}м
├─ Позиции: ${status.positionsCount}
├─ Дневная прибыль: ${status.dailyPnL.toFixed(2)} USDT
├─ Всего сделок: ${status.totalTrades}
├─ Винрейт: ${performance.winRate.toFixed(1)}%
├─ Profit Factor: ${performance.profitFactor.toFixed(2)}
└─ Ошибки: ${status.errorCount}
    `.trim();
    }
    /**
     * Экстренная остановка
     */
    async emergencyStop(reason) {
        this.logger.warn({ reason }, 'Экстренная остановка бота');
        try {
            // Закрываем все позиции
            await this.strategy.forceCloseAllPositions();
            // Останавливаем торговлю
            await this.stop();
        }
        catch (error) {
            this.logger.error({ error }, 'Ошибка экстренной остановки');
        }
    }
    /**
     * Перезапустить бота
     */
    async restart() {
        this.logger.info('Перезапуск бота');
        try {
            await this.stop();
            await new Promise(resolve => setTimeout(resolve, 5000)); // Пауза 5 секунд
            await this.start();
        }
        catch (error) {
            this.logger.error({ error }, 'Ошибка перезапуска');
            throw error;
        }
    }
    /**
     * Проверить соединение с API
     */
    async validateApiConnection() {
        try {
            // Проверяем REST API
            const accountInfo = await this.mexcRest.getAccountInfo();
            this.logger.info({ balanceCount: accountInfo.balances.length }, 'API подключение проверено');
            // Проверяем наличие торговых пар
            for (const symbol of this.config.targetPairs) {
                const [instrument] = await this.mexcRest.getExchangeInfo(symbol);
                if (!instrument) {
                    throw new Error(`Торговая пара ${symbol} не найдена`);
                }
            }
        }
        catch (error) {
            throw new Error(`Ошибка API соединения: ${error}`);
        }
    }
    /**
     * Настроить логгер
     */
    setupLogger() {
        // Создаем папку для логов
        const logDir = path_1.default.dirname('./logs/scalper.log');
        if (!fs_1.default.existsSync(logDir)) {
            fs_1.default.mkdirSync(logDir, { recursive: true });
        }
        const prettyTransport = pino_1.default.transport({
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l o',
                singleLine: false
            }
        });
        this.logger = (0, pino_1.default)({
            level: 'info',
            timestamp: pino_1.default.stdTimeFunctions.isoTime
        }, prettyTransport);
    }
    /**
     * Настроить обработчики событий
     */
    setupEventHandlers() {
        // Обработка завершения процесса
        process.on('SIGINT', async () => {
            this.logger.info('Получен сигнал SIGINT, завершение работы...');
            await this.stop();
            process.exit(0);
        });
        process.on('SIGTERM', async () => {
            this.logger.info('Получен сигнал SIGTERM, завершение работы...');
            await this.stop();
            process.exit(0);
        });
        // Обработка необработанных ошибок
        process.on('uncaughtException', (error) => {
            this.logger.fatal({ error }, 'Необработанная ошибка');
            this.emergencyStop('Необработанная ошибка');
        });
        process.on('unhandledRejection', (reason) => {
            this.logger.fatal({ reason }, 'Необработанное отклонение промиса');
            this.emergencyStop('Необработанное отклонение промиса');
        });
    }
    /**
     * Запустить мониторинг здоровья бота
     */
    startHealthCheck() {
        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.performHealthCheck();
            }
            catch (error) {
                this.logger.error({ error }, 'Ошибка проверки здоровья');
                this.errorCount++;
                this.lastError = error instanceof Error ? error.message : 'Health check failed';
            }
        }, 60000); // Каждую минуту
    }
    /**
     * Выполнить проверку здоровья
     */
    async performHealthCheck() {
        // Проверяем WebSocket соединение
        if (!this.mexcWs.isConnected()) {
            this.logger.warn('WebSocket отключен, попытка переподключения');
            try {
                await this.mexcWs.connect();
            }
            catch (error) {
                throw new Error(`Не удалось переподключить WebSocket: ${error}`);
            }
        }
        // Проверяем REST API
        try {
            await this.mexcRest.getAccountInfo();
        }
        catch (error) {
            throw new Error(`REST API недоступен: ${error}`);
        }
        // Проверяем состояние позиций
        const positionCount = this.positionManager.getPositionCount();
        if (positionCount > this.config.maxParallelPositions) {
            this.logger.warn({ positionCount }, 'Превышено максимальное количество позиций');
        }
        // Логируем статистику каждые 5 минут
        const now = Date.now();
        if (now % (5 * 60 * 1000) < 60000) {
            const stats = this.getStats();
            this.statsLogger.logPeriodic(stats);
        }
    }
    /**
     * Получить конфигурацию
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Обновить конфигурацию (только некоторые параметры)
     */
    updateConfig(updates) {
        try {
            const newConfig = { ...this.config, ...updates };
            const errors = (0, trading_1.validateConfig)(newConfig);
            if (errors.length > 0) {
                this.logger.warn({ errors }, 'Ошибки валидации новой конфигурации');
                return false;
            }
            this.config = newConfig;
            this.logger.info({ updates }, 'Конфигурация обновлена');
            return true;
        }
        catch (error) {
            this.logger.error({ error }, 'Ошибка обновления конфигурации');
            return false;
        }
    }
}
exports.ScalperBot = ScalperBot;
//# sourceMappingURL=scalper-bot.js.map