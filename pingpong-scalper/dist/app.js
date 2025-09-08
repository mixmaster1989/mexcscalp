"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PingPongScalper = void 0;
require("dotenv/config");
const mexcRest_1 = require("./exchanges/mexcRest");
const mexcWebSocket_1 = require("./exchanges/mexcWebSocket");
const engine_1 = require("./core/engine");
const alpha_1 = require("./core/alpha");
const risk_1 = require("./core/risk");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class PingPongScalper {
    constructor() {
        this.isRunning = false;
        // Загружаем конфигурацию
        this.config = this.loadConfig();
        // Инициализируем компоненты
        this.restClient = new mexcRest_1.MexcRestClient(process.env.MEXC_API_KEY, process.env.MEXC_SECRET_KEY);
        this.wsClient = new mexcWebSocket_1.MexcWebSocketClient(this.config.symbol);
        this.statsCalculator = new alpha_1.MicroStatsCalculator();
        this.riskManager = new risk_1.RiskManager(this.config);
        this.engine = new engine_1.PingPongEngine(this.config, this.wsClient, this.restClient, this.statsCalculator, this.riskManager);
        this.setupEventHandlers();
    }
    loadConfig() {
        try {
            const configPath = path.join(__dirname, '../config/default.json');
            const configData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);
            // Переопределяем значения из переменных окружения
            if (process.env.SYMBOL)
                config.symbol = process.env.SYMBOL;
            if (process.env.ORDER_NOTIONAL)
                config.orderNotional = parseFloat(process.env.ORDER_NOTIONAL);
            if (process.env.MAX_LAYERS)
                config.maxLayers = parseInt(process.env.MAX_LAYERS, 10);
            if (process.env.DRY_RUN)
                config.dryRun = process.env.DRY_RUN === 'true';
            return config;
        }
        catch (error) {
            throw new Error(`Ошибка загрузки конфигурации: ${error}`);
        }
    }
    setupEventHandlers() {
        // Обработчики событий движка
        this.engine.on('started', () => {
            console.log('🚀 Ping-Pong скальпер запущен');
        });
        this.engine.on('stopped', () => {
            console.log('🛑 Ping-Pong скальпер остановлен');
        });
        this.engine.on('microStats', (stats) => {
            console.log('📊 Микро-статистика обновлена:', {
                mid: stats.mid.toFixed(2),
                spread: stats.spread.toFixed(4),
                s: stats.s.toFixed(4),
                tp: stats.tp.toFixed(4),
                sl: stats.sl.toFixed(4)
            });
        });
        this.engine.on('trade', (trade) => {
            console.log('💰 Новая сделка:', {
                symbol: trade.symbol,
                side: trade.side,
                price: trade.price.toFixed(2),
                qty: trade.qty.toFixed(6)
            });
        });
        this.engine.on('error', (error) => {
            console.error('❌ Ошибка движка:', error.message);
        });
        // Обработчики системных сигналов
        process.on('SIGINT', () => {
            console.log('📡 Получен сигнал SIGINT, завершаем работу...');
            this.stop();
        });
        process.on('SIGTERM', () => {
            console.log('📡 Получен сигнал SIGTERM, завершаем работу...');
            this.stop();
        });
        process.on('uncaughtException', (error) => {
            console.error('💥 Необработанное исключение:', error);
            this.stop();
            process.exit(1);
        });
        process.on('unhandledRejection', (reason) => {
            console.error('💥 Необработанное отклонение промиса:', reason);
            this.stop();
            process.exit(1);
        });
    }
    async start() {
        if (this.isRunning) {
            console.log('⚠️ Скальпер уже запущен');
            return;
        }
        try {
            console.log('🔄 Инициализация Ping-Pong скальпера...');
            // Проверяем подключение к API
            const accountInfo = await this.restClient.getAccountInfo();
            console.log('✅ Подключение к MEXC API установлено');
            console.log('💰 Баланс аккаунта:', accountInfo.balances);
            // ПРИНУДИТЕЛЬНО ПОДКЛЮЧАЕМ WEBSOCKET!
            console.log('🔌 Принудительно подключаемся к WebSocket...');
            this.wsClient.connect();
            // Запускаем движок
            await this.engine.start();
            this.isRunning = true;
            console.log('🎯 Ping-Pong скальпер успешно запущен!');
            // Запускаем периодическую отчетность
            this.startPeriodicReporting();
        }
        catch (error) {
            console.error('❌ Ошибка запуска скальпера:', error.message);
            throw error;
        }
    }
    async stop() {
        if (!this.isRunning) {
            console.log('⚠️ Скальпер не запущен');
            return;
        }
        try {
            console.log('🔄 Остановка Ping-Pong скальпера...');
            // Останавливаем движок
            await this.engine.stop();
            // Отключаемся от WebSocket
            this.wsClient.disconnect();
            this.isRunning = false;
            console.log('✅ Ping-Pong скальпер остановлен');
            // Выводим финальную статистику
            this.printFinalStats();
        }
        catch (error) {
            console.error('❌ Ошибка остановки скальпера:', error.message);
            throw error;
        }
    }
    startPeriodicReporting() {
        setInterval(() => {
            if (this.isRunning) {
                this.printSessionStats();
            }
        }, 30000); // Каждые 30 секунд
    }
    printSessionStats() {
        const stats = this.engine.getSessionStats();
        console.log('📈 Статистика сессии:', {
            'Общий PnL': `${stats.totalPnL.toFixed(4)} USDC`,
            'Всего сделок': stats.totalTrades,
            'Прибыльных': stats.winningTrades,
            'Убыточных': stats.losingTrades,
            'Серия убытков': stats.consecutiveLosses,
            'Сделок/мин': stats.fillsPerMinute.toFixed(1),
            'Средняя длительность': `${stats.avgTradeDuration.toFixed(1)}с`,
            'Дневная просадка': `${stats.dailyDrawdown.toFixed(2)}%`
        });
    }
    printFinalStats() {
        const stats = this.engine.getSessionStats();
        const runtime = (Date.now() - stats.startTime) / 1000 / 60; // минуты
        console.log('🏁 ФИНАЛЬНАЯ СТАТИСТИКА:');
        console.log('═══════════════════════════════════════');
        console.log(`⏱️  Время работы: ${runtime.toFixed(1)} минут`);
        console.log(`💰 Общий PnL: ${stats.totalPnL.toFixed(4)} USDC`);
        console.log(`�� Всего сделок: ${stats.totalTrades}`);
        console.log(`✅ Прибыльных: ${stats.winningTrades}`);
        console.log(`❌ Убыточных: ${stats.losingTrades}`);
        console.log(`📈 Win Rate: ${stats.totalTrades > 0 ? (stats.winningTrades / stats.totalTrades * 100).toFixed(1) : 0}%`);
        console.log(`🔥 Серия убытков: ${stats.consecutiveLosses}`);
        console.log(`⚡ Сделок/мин: ${stats.fillsPerMinute.toFixed(1)}`);
        console.log(`⏰ Средняя длительность: ${stats.avgTradeDuration.toFixed(1)}с`);
        console.log(`📉 Дневная просадка: ${stats.dailyDrawdown.toFixed(2)}%`);
        console.log('═══════════════════════════════════════');
    }
}
exports.PingPongScalper = PingPongScalper;
// Запуск приложения
async function main() {
    const scalper = new PingPongScalper();
    try {
        await scalper.start();
    }
    catch (error) {
        console.error('💥 Критическая ошибка:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
//# sourceMappingURL=app.js.map