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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const Mexc = __importStar(require("mexc-api-sdk"));
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const pino_1 = __importDefault(require("pino"));
const { getRandomJoke } = require('../jokes');
class MexcScalper {
    restClient;
    telegramBot;
    logger;
    isRunning = false;
    // Для отслеживания ордеров
    lastOrders = [];
    totalTrades = 0;
    sessionPnL = 0;
    lastStatusUpdate = 0;
    constructor() {
        this.restClient = new Mexc.Spot(process.env.MEXC_API_KEY, process.env.MEXC_SECRET_KEY);
        this.telegramBot = new node_telegram_bot_api_1.default(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
        this.logger = (0, pino_1.default)({ level: 'info' });
        this.setupTelegramHandlers();
    }
    async start() {
        try {
            this.isRunning = true;
            this.logger.info('🚀 Мы запустили MEXC Скальпер');
            // Инициализация - получаем текущие ордера
            await this.initializeOrders();
            // Отправка уведомления
            await this.sendTelegramMessage('🚀 *Мы запустили MEXC Скальпер*\n\n' +
                '🎯 Автоматический скальпинг активирован!\n' +
                '📊 Мониторинг каждые 30 секунд\n' +
                '🔄 Авто-размещение ордеров\n' +
                '⚡ Уведомления о сделках\n\n' +
                getRandomJoke());
            // Запуск основного цикла
            setInterval(async () => {
                try {
                    await this.maintainOrders();
                }
                catch (error) {
                    this.logger.error('Ошибка в основном цикле:', error);
                }
            }, 30000);
        }
        catch (error) {
            this.logger.error('Ошибка запуска:', error);
            throw error;
        }
    }
    async stop() {
        this.isRunning = false;
        const finalReport = '🛑 *Мы остановили MEXC Скальпер*\n\n' +
            '📊 Финальная статистика:\n' +
            `• Всего сделок: ${this.totalTrades}\n` +
            `• P&L сессии: $${this.sessionPnL.toFixed(2)}\n` +
            this.getBalanceMessage() + '\n\n' +
            getRandomJoke();
        await this.sendTelegramMessage(finalReport);
        this.logger.info('🛑 Мы остановили MEXC Скальпер');
    }
    async initializeOrders() {
        try {
            const orders = await this.restClient.openOrders('ETHUSDC');
            this.lastOrders = orders;
            this.logger.info(`📊 Инициализировано ${orders.length} активных ордеров`);
        }
        catch (error) {
            this.logger.error('Ошибка инициализации ордеров:', error);
        }
    }
    async maintainOrders() {
        try {
            const currentOrders = await this.restClient.openOrders('ETHUSDC');
            const currentPrice = await this.restClient.tickerPrice('ETHUSDC');
            const price = parseFloat(currentPrice.price);
            // Проверяем изменения
            const buyOrders = currentOrders.filter((o) => o.side === 'BUY').length;
            const sellOrders = currentOrders.filter((o) => o.side === 'SELL').length;
            this.logger.info(`📊 Статус: ${buyOrders} buy, ${sellOrders} sell ордеров`);
            // Поддерживаем баланс: минимум 4 buy и 4 sell ордера
            if (buyOrders < 4) {
                await this.placeMissingBuyOrders(currentOrders, price);
            }
            if (sellOrders < 4) {
                await this.placeMissingSellOrders(currentOrders, price);
            }
            // Обновляем статус каждые 15 минут
            const now = Date.now();
            if (now - this.lastStatusUpdate > 15 * 60 * 1000) {
                await this.sendStatusUpdate(currentOrders);
                this.lastStatusUpdate = now;
            }
            this.lastOrders = currentOrders;
        }
        catch (error) {
            this.logger.error('Ошибка поддержания ордеров:', error);
        }
    }
    async placeMissingBuyOrders(currentOrders, price) {
        const existingBuyOrders = currentOrders.filter((o) => o.side === 'BUY');
        const neededBuyOrders = 4 - existingBuyOrders.length;
        if (neededBuyOrders <= 0)
            return;
        this.logger.info(`📈 Размещаю ${neededBuyOrders} недостающих buy ордеров`);
        const offset = 5.70;
        const step = 4.275;
        for (let i = 0; i < neededBuyOrders; i++) {
            const level = existingBuyOrders.length + i;
            const orderPrice = price - offset - (step * level);
            const roundedPrice = Math.round(orderPrice * 100) / 100;
            const qty = 0.000345;
            try {
                const timestamp = Date.now();
                const clientOrderId = `AUTO_BUY_${level}_${timestamp}`;
                await this.restClient.newOrder('ETHUSDC', 'BUY', 'LIMIT', {
                    timeInForce: 'GTC',
                    price: roundedPrice.toString(),
                    quantity: qty.toString(),
                    newClientOrderId: clientOrderId,
                });
                this.logger.info(`✅ Buy ордер ${level} размещен: $${roundedPrice}`);
                // Небольшая пауза
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            catch (error) {
                this.logger.error(`❌ Ошибка размещения buy ордера ${level}:`, error);
            }
        }
    }
    async placeMissingSellOrders(currentOrders, price) {
        const existingSellOrders = currentOrders.filter((o) => o.side === 'SELL');
        const neededSellOrders = 4 - existingSellOrders.length;
        if (neededSellOrders <= 0)
            return;
        this.logger.info(`📉 Размещаю ${neededSellOrders} недостающих sell ордеров`);
        const offset = 5.70;
        const step = 4.275;
        for (let i = 0; i < neededSellOrders; i++) {
            const level = existingSellOrders.length + i;
            const orderPrice = price + offset + (step * level);
            const roundedPrice = Math.round(orderPrice * 100) / 100;
            const qty = 0.000344;
            try {
                const timestamp = Date.now();
                const clientOrderId = `AUTO_SELL_${level}_${timestamp}`;
                await this.restClient.newOrder('ETHUSDC', 'SELL', 'LIMIT', {
                    timeInForce: 'GTC',
                    price: roundedPrice.toString(),
                    quantity: qty.toString(),
                    newClientOrderId: clientOrderId,
                });
                this.logger.info(`✅ Sell ордер ${level} размещен: $${roundedPrice}`);
                // Небольшая пауза
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            catch (error) {
                this.logger.error(`❌ Ошибка размещения sell ордера ${level}:`, error);
            }
        }
    }
    async sendStatusUpdate(orders) {
        try {
            const buyOrders = orders.filter((o) => o.side === 'BUY').length;
            const sellOrders = orders.filter((o) => o.side === 'SELL').length;
            let message = '📊 *АВТОМАТИЧЕСКИЙ СТАТУС*\n\n';
            message += this.getBalanceMessage() + '\n\n';
            message += '📋 *Активные ордера:*\n';
            message += `• 🟢 Buy: ${buyOrders}\n`;
            message += `• 🔴 Sell: ${sellOrders}\n`;
            message += `• 📈 Всего: ${orders.length}\n\n`;
            message += '📈 *Статистика:*\n';
            message += `• Сделок: ${this.totalTrades}\n`;
            message += `• P&L: $${this.sessionPnL.toFixed(2)}\n`;
            message += '\n🎯 Автоматический скальпинг активен!\n';
            message += '⏰ Следующий статус: через 15 мин\n\n';
            message += getRandomJoke();
            await this.sendTelegramMessage(message);
        }
        catch (error) {
            this.logger.error('Ошибка отправки статуса:', error);
        }
    }
    getBalanceMessage() {
        // Простая заглушка - в реальности нужно получать баланс
        return '💰 Баланс: ~90 USDC, ~0.001 ETH';
    }
    setupTelegramHandlers() {
        this.telegramBot.on('message', async (msg) => {
            if (!msg.text)
                return;
            try {
                if (msg.text === '/start') {
                    await this.telegramBot.sendMessage(msg.chat.id, '👋 Привет! Мы - команда MEXC Скальпер!\n\n' + getRandomJoke());
                }
                else if (msg.text === '/status') {
                    const status = this.isRunning ? '✅ Запущен (автоматический режим)' : '❌ Остановлен';
                    await this.telegramBot.sendMessage(msg.chat.id, `🤖 Статус: ${status}\n\n` + getRandomJoke());
                }
            }
            catch (error) {
                this.logger.error('Ошибка Telegram:', error);
            }
        });
    }
    async sendTelegramMessage(text) {
        try {
            await this.telegramBot.sendMessage(process.env.TELEGRAM_ADMIN_CHAT_IDS, text, { parse_mode: 'Markdown' });
        }
        catch (error) {
            this.logger.error('Ошибка отправки в Telegram:', error);
        }
    }
}
// Запуск
async function main() {
    try {
        console.log('🚀 Запуск MEXC Скальпер...');
        const scalper = new MexcScalper();
        await scalper.start();
        console.log('✅ MEXC Скальпер запущен в АВТОМАТИЧЕСКОМ РЕЖИМЕ!');
        // Graceful shutdown
        process.on('SIGINT', async () => {
            console.log('🛑 Получен SIGINT, завершаем...');
            await scalper.stop();
            process.exit(0);
        });
        process.on('SIGTERM', async () => {
            console.log('🛑 Получен SIGTERM, завершаем...');
            await scalper.stop();
            process.exit(0);
        });
    }
    catch (error) {
        console.error('❌ Критическая ошибка:', error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=main_backup_20250902_110717.js.map