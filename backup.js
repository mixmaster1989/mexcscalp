"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MexcScalpBot = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = require("fs");
const pino_1 = __importDefault(require("pino"));
// Загружаем переменные окружения
dotenv_1.default.config();
const types_1 = require("./core/types");
const mexcRest_1 = require("./infra/mexcRest");
const mexcWs_1 = require("./infra/mexcWs");
const regime_1 = require("./core/regime");
const hedgehog_1 = require("./strategies/hedgehog");
const db_1 = require("./storage/db");
const bot_1 = require("./telegram/bot");
/**
 * Главный класс торговой системы MEXC Scalp Bot
 */
class MexcScalpBot {
    logger;
    config;
    restClient;
    wsClient;
    regimeDetector;
    hedgehogStrategy;
    telegramBot;
    instrument = null;
    isRunning = false;
    shutdownInProgress = false;
    constructor() {
        // Инициализируем логгер
        this.logger = (0, pino_1.default)({
            level: process.env.LOG_LEVEL || 'info',
            transport: {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'SYS:standard'
                }
            }
        });
        this.logger.info('🚀 Инициализация MEXC Scalp Bot...');
    }
    /**
     * Загрузить и валидировать конфигурацию
     */
    loadConfig() {
        try {
            const configPath = process.env.CONFIG_FILE || './config/defaults.ethusdc.json';
            const configData = JSON.parse((0, fs_1.readFileSync)(configPath, 'utf-8'));
            // Валидируем конфигурацию через zod
            this.config = types_1.ConfigSchema.parse(configData);
            this.logger.info('✅ Конфигурация загружена и валидирована', {
                symbol: this.config.symbol,
                deposit: this.config.deposit_usd,
                regime: this.config.regime,
                hedgehog: this.config.hedgehog
            });
        }
        catch (error) {
            this.logger.error('❌ Ошибка загрузки конфигурации:', error);
            throw error;
        }
    }
    /**
     * Инициализировать API клиенты
     */
    initClients() {
        const apiKey = process.env.MEXC_API_KEY;
        const secretKey = process.env.MEXC_SECRET_KEY;
        const baseUrl = process.env.MEXC_BASE_URL || 'https://api.mexc.com';
        const wsUrl = process.env.MEXC_WS_URL || 'wss://wbs.mexc.com/ws';
        if (!apiKey || !secretKey) {
            throw new Error('MEXC API ключи не настроены в переменных окружения');
        }
        // Инициализируем REST клиент
        this.restClient = new mexcRest_1.MexcRestClient(apiKey, secretKey, baseUrl);
        // Инициализируем WebSocket клиент
        this.wsClient = new mexcWs_1.MexcWebSocketClient(wsUrl, this.config.ws.max_reconnect_attempts, this.config.ws.reconnect_delay_ms, this.config.ws.heartbeat_interval_ms);
        this.logger.info('✅ API клиенты инициализированы');
    }
    /**
     * Получить метаданные инструмента
     */
    async loadInstrumentInfo() {
        try {
            const instruments = await this.restClient.getExchangeInfo(this.config.symbol);
            if (instruments.length === 0) {
                throw new Error(`Инструмент ${this.config.symbol} не найден`);
            }
            this.instrument = instruments[0];
            this.logger.info('✅ Метаданные инструмента загружены', {
                symbol: this.instrument.symbol,
                tickSize: this.instrument.tickSize,
                stepSize: this.instrument.stepSize,
                minNotional: this.instrument.minNotional
            });
        }
        catch (error) {
            this.logger.error('❌ Ошибка загрузки метаданных инструмента:', error);
            throw error;
        }
    }
    /**
     * Инициализировать торговые компоненты
     */
    initTradingComponents() {
        if (!this.instrument) {
            throw new Error('Инструмент не загружен');
        }
        // Инициализируем детектор режимов
        this.regimeDetector = new regime_1.RegimeDetector(this.config);
        // Инициализируем стратегию Ёршики
        this.hedgehogStrategy = new hedgehog_1.HedgehogStrategy(this.config, this.instrument, this.restClient);
        this.setupEventHandlers();
        // Инициализируем Telegram бота
        this.initTelegramBot();
        this.logger.info('✅ Торговые компоненты инициализированы');
    }
    /**
     * Инициализировать Telegram бота
     */
    initTelegramBot() {
        const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
        const groupChatId = parseInt(process.env.TELEGRAM_ADMIN_CHAT_IDS || '0');
        if (!telegramToken || !groupChatId) {
            this.logger.warn('⚠️ Telegram бот не настроен (отсутствуют токен или ID группы)');
            return;
        }
        this.telegramBot = new bot_1.MexcTelegramBot(telegramToken, groupChatId, () => this.getTradingStats(), () => this.getSystemStatus(), (command, chatId) => this.handleTradingCommand(command, chatId), this.logger);
        this.logger.info('✅ Telegram бот инициализирован');
    }
    /**
     * Получить торговую статистику для Telegram бота
     */
    getTradingStats() {
        const stats = this.hedgehogStrategy?.getStats() || {
            isActive: false,
            activeLevels: 0,
            activeTakeProfits: 0,
            currentInventory: 0,
            inventoryNotional: 0,
            currentRegime: 'normal',
            midPrice: 0,
            atr1m: 0
        };
        return {
            isActive: stats.isActive,
            currentRegime: stats.currentRegime,
            activeLevels: stats.activeLevels,
            activeTPs: stats.activeTakeProfits,
            inventory: stats.currentInventory,
            inventoryNotional: stats.inventoryNotional,
            midPrice: stats.midPrice,
            pnlToday: 0,
            tradesCount: 0,
            winRate: 0,
            // Новые поля для расширенной статистики
            totalTrades: 0,
            profitableTrades: 0,
            losingTrades: 0,
            totalPnL: 0,
            dailyPnL: 0,
            maxDrawdown: 0
        };
    }
    /**
     * Получить статус системы для Telegram бота
     */
    getSystemStatus() {
        const baseStatus = {
            bot: {
                status: this.isRunning ? 'running' : 'stopped',
                uptime: Date.now() - this.startTime,
                version: '1.0.0'
            },
            trading: {
                status: this.hedgehogStrategy?.getStats().isActive ? 'active' : 'stopped',
                regime: this.regimeDetector?.getCurrentRegime() || 'normal',
                lastUpdate: Date.now()
            },
            api: {
                rest: true,
                websocket: this.wsClient?.isConnected() || false,
                lastCheck: Date.now()
            },
            database: {
                connected: true,
                lastBackup: Date.now() - 24 * 60 * 60 * 1000
            }
        };
        return {
            ...baseStatus,
            // Новые поля для упрощенного доступа
            systemStatus: baseStatus.bot.status,
            tradingEnabled: baseStatus.trading.status === 'active',
            totalBalance: 100 // TODO: Получать реальный баланс
        };
    }
    *Обработать() { }
    торговую;
    команду;
    из;
    Telegram;
    *() { }
}
exports.MexcScalpBot = MexcScalpBot;
/;
async;
handleTradingCommand(command, string, chatId, number);
Promise < string > {
    try: {
        switch(command) {
        },
        case: 'start_trading',
        : .hedgehogStrategy
    }
};
{
    await this.hedgehogStrategy.start();
    return '✅ Торговля запущена';
}
return '❌ Стратегия не инициализирована';
'stop_trading';
if (this.hedgehogStrategy) {
    await this.hedgehogStrategy.stop();
    return '⏹️ Торговля остановлена';
}
return '❌ Стратегия не инициализирована';
'pause_trading';
if (this.hedgehogStrategy) {
    await this.hedgehogStrategy.stop();
    return '⏸️ Торговля приостановлена';
}
return '❌ Стратегия не инициализирована';
'emergency_stop';
if (this.hedgehogStrategy) {
    await this.hedgehogStrategy.stop();
    return '🚨 Аварийная остановка выполнена';
}
return '❌ Стратегия не инициализирована';
return '❓ Неизвестная команда';
try { }
catch (error) {
    this.logger.error('Ошибка выполнения торговой команды:', error);
    return `❌ Ошибка: ${error}`;
}
setupEventHandlers();
void {
    // События WebSocket
    this: .wsClient.on('connected', () => {
        this.logger.info('🔗 WebSocket подключен');
    }),
    this: .wsClient.on('disconnected', () => {
        this.logger.warn('🔌 WebSocket отключен');
    }),
    this: .wsClient.on('error', (error) => {
        this.logger.error('❌ Ошибка WebSocket:', error);
    }),
    this: .wsClient.on('bookTicker', (data) => {
        const midPrice = (data.bidPrice + data.askPrice) / 2;
        // Обновляем данные в компонентах
        // В реальной реализации здесь нужно получать ATR
        const mockATR = midPrice * 0.001; // Мок ATR для демонстрации
        this.hedgehogStrategy.updateMarketData(midPrice, mockATR);
    }),
    this: .wsClient.on('trade', (trade) => {
        // Обновляем детектор режимов
        this.regimeDetector.updateTrade(trade.price, trade.quantity, !trade.buyer);
    }),
    // События детектора режимов
    this: .regimeDetector.on('regimeChange', (data) => {
        this.logger.info('📊 Изменение режима рынка', {
            previous: data.previous,
            current: data.current,
            confidence: data.data.confidence
        });
        // Обновляем параметры стратегии
        const regimeParams = this.regimeDetector.getRegimeParameters();
        this.hedgehogStrategy.updateRegimeParameters(data.current, regimeParams);
        // Уведомляем в Telegram
        if (this.telegramBot) {
            this.telegramBot.notifyRegimeChange(data.previous, data.current, data.data.confidence);
        }
    }),
    // События стратегии
    this: .hedgehogStrategy.on('started', () => {
        this.logger.info('🎯 Стратегия Ёршики запущена');
    }),
    this: .hedgehogStrategy.on('stopped', () => {
        this.logger.info('⏹️ Стратегия Ёршики остановлена');
    }),
    this: .hedgehogStrategy.on('fill', (fill) => {
        this.logger.info('💰 Исполнение ордера', {
            side: fill.side,
            price: fill.price,
            quantity: fill.quantity,
            symbol: fill.symbol
        });
        // Уведомляем в Telegram
        if (this.telegramBot) {
            this.telegramBot.notifyTrade(fill);
        }
    }),
    this: .hedgehogStrategy.on('error', (error) => {
        this.logger.error('❌ Ошибка стратегии:', error);
        // Уведомляем в Telegram
        if (this.telegramBot) {
            this.telegramBot.notifyError(error, 'Hedgehog Strategy');
        }
    })
};
async;
connectWebSocket();
Promise < void  > {
    try: {
        await, this: .wsClient.connect(),
        // Подписываемся на потоки данных
        this: .wsClient.subscribeBookTicker(this.config.symbol),
        this: .wsClient.subscribeTrades(this.config.symbol),
        this: .logger.info('✅ WebSocket потоки подключены')
    }, catch(error) {
        this.logger.error('❌ Ошибка подключения WebSocket:', error);
        throw error;
    }
};
async;
healthCheck();
Promise < void  > {
    try: {
        // Проверяем REST API
        const: pingResult = await this.restClient.ping(),
        if(, pingResult) {
            throw new Error('REST API недоступен');
        }
        // Проверяем права доступа к аккаунту
        ,
        // Проверяем права доступа к аккаунту
        const: accountInfo = await this.restClient.getAccountInfo(),
        if(, accountInfo) { }, : .canTrade
    }
};
{
    throw new Error('Аккаунт не имеет права на торговлю');
}
this.logger.info('✅ Health check пройден', {
    canTrade: accountInfo.canTrade,
    balancesCount: accountInfo.balances.length
});
try { }
catch (error) {
    this.logger.error('❌ Health check не пройден:', error);
    throw error;
}
setupShutdownHandlers();
void {
    const: shutdown = async (signal) => {
        if (this.shutdownInProgress) {
            return;
        }
        this.shutdownInProgress = true;
        this.logger.info(`🛑 Получен сигнал ${signal}, начинаем безопасное завершение...`);
        try {
            // Уведомляем в Telegram об остановке
            if (this.telegramBot) {
                await this.telegramBot.notifySystem('Система остановлена', '⏹️ MEXC Scalp Bot остановлен');
            }
            // Останавливаем стратегии
            if (this.hedgehogStrategy) {
                await this.hedgehogStrategy.stop();
            }
            // Останавливаем Telegram бота
            if (this.telegramBot) {
                await this.telegramBot.stop();
            }
            // Отключаем WebSocket
            if (this.wsClient) {
                this.wsClient.disconnect();
            }
            // Закрываем базу данных
            const db = (0, db_1.getDatabase)();
            await db.disconnect();
            this.logger.info('✅ Безопасное завершение выполнено');
            process.exit(0);
        }
        catch (error) {
            this.logger.error('❌ Ошибка при завершении:', error);
            process.exit(1);
        }
    },
    process, : .on('SIGINT', () => shutdown('SIGINT')),
    process, : .on('SIGTERM', () => shutdown('SIGTERM')),
    process, : .on('uncaughtException', (error) => {
        this.logger.fatal('💥 Необработанное исключение:', error);
        shutdown('uncaughtException');
    }),
    process, : .on('unhandledRejection', (reason) => {
        this.logger.fatal('💥 Необработанный rejection:', reason);
        shutdown('unhandledRejection');
    })
};
/**
 * Запустить торговую систему
 */
async;
start();
Promise < void  > {
    try: {
        this: .logger.info('🚀 Запуск MEXC Scalp Bot...'),
        // 1. Загружаем конфигурацию
        this: .loadConfig(),
        // 2. Инициализируем базу данных
        await, initDatabase(process) { }, : .env.DATABASE_PATH,
        this: .logger.info('✅ База данных инициализирована'),
        // 3. Инициализируем API клиенты
        this: .initClients(),
        // 4. Проверяем здоровье системы
        await, this: .healthCheck(),
        // 5. Загружаем метаданные инструмента
        await, this: .loadInstrumentInfo(),
        // 6. Инициализируем торговые компоненты
        this: .initTradingComponents(),
        // 7. Подключаем WebSocket
        await, this: .connectWebSocket(),
        // 8. Настраиваем обработчики завершения
        this: .setupShutdownHandlers(),
        : .telegramBot
    }
};
{
    await this.telegramBot.start();
}
// 10. Запускаем стратегию
await this.hedgehogStrategy.start();
this.isRunning = true;
this.logger.info('🎉 MEXC Scalp Bot успешно запущен!');
// Уведомляем в Telegram о запуске
if (this.telegramBot) {
    await this.telegramBot.notifySystem('Система запущена', '🚀 MEXC Scalp Bot успешно запущен и готов к торговле!');
}
// Периодически выводим статистику
this.startStatsLogger();
try { }
catch (error) {
    this.logger.fatal('💥 Критическая ошибка при запуске:', error);
    process.exit(1);
}
startStatsLogger();
void {
    setInterval() { }
}();
{
    if (this.isRunning && this.hedgehogStrategy) {
        const stats = this.hedgehogStrategy.getStats();
        const regimeData = this.regimeDetector.getLastRegimeData();
        this.logger.info('📊 Статистика системы', {
            regime: regimeData?.regime || 'unknown',
            confidence: regimeData?.confidence || 0,
            activeLevels: stats.activeLevels,
            activeTPs: stats.activeTakeProfits,
            inventory: stats.currentInventory,
            inventoryNotional: stats.inventoryNotional,
            midPrice: stats.midPrice
        });
    }
}
30000;
; // Каждые 30 секунд
// Запускаем торговую систему
if (require.main === module) {
    const bot = new MexcScalpBot();
    bot.start().catch((error) => {
        console.error('Критическая ошибка:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map