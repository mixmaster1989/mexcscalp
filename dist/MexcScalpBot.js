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
exports.MexcScalpBot = void 0;
const Mexc = __importStar(require("mexc-api-sdk"));
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const pino_1 = __importDefault(require("pino"));
const jokes_1 = require("../jokes");
class MexcScalpBot {
    restClient;
    telegramBot;
    logger;
    isRunning = false;
    constructor() {
        // Инициализация API клиента
        this.restClient = new Mexc.Spot(process.env.MEXC_API_KEY, process.env.MEXC_SECRET_KEY);
        // Инициализация Telegram бота
        this.telegramBot = new node_telegram_bot_api_1.default(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
        this.logger = (0, pino_1.default)({ level: 'info' });
        this.setupTelegramHandlers();
    }
    async start() {
        try {
            this.isRunning = true;
            this.logger.info('🚀 Мы запустили MEXC Scalp Bot');
            // Проверка подключения
            const ping = await this.restClient.ping();
            this.logger.info('✅ API подключен');
            // Отправка уведомления
            await this.sendTelegramMessage('🚀 *Мы запустили MEXC Scalp Bot*\n\nСистема готова к торговле!\n\n' + (0, jokes_1.getRandomJoke)());
        }
        catch (error) {
            this.logger.error('Ошибка запуска:', error);
            throw error;
        }
    }
    async stop() {
        this.isRunning = false;
        this.logger.info('🛑 Мы остановили MEXC Scalp Bot');
        await this.sendTelegramMessage('⏹️ *Мы остановили MEXC Scalp Bot*\n\n' + (0, jokes_1.getRandomJoke)());
    }
    setupTelegramHandlers() {
        this.telegramBot.on('message', async (msg) => {
            if (!msg.text)
                return;
            try {
                if (msg.text === '/start') {
                    await this.telegramBot.sendMessage(msg.chat.id, '👋 Привет! Мы - команда MEXC Scalp Bot!\n\n' + (0, jokes_1.getRandomJoke)());
                }
            }
            catch (error) {
                this.logger.error('Ошибка обработки сообщения:', error);
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
    isBotRunning() {
        return this.isRunning;
    }
}
exports.MexcScalpBot = MexcScalpBot;
//# sourceMappingURL=MexcScalpBot.js.map