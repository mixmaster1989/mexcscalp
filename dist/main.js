"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const mexcRest_1 = require("./infra/mexcRest");
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const db_1 = require("./storage/db");
const pino_1 = __importDefault(require("pino"));
class MexcScalper {
    restClient;
    telegramBot;
    logger;
    db = null;
    isRunning = false;
    constructor() {
        this.restClient = new mexcRest_1.MexcRestClient(process.env.MEXC_API_KEY, process.env.MEXC_SECRET_KEY);
        this.telegramBot = new node_telegram_bot_api_1.default(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
        this.logger = (0, pino_1.default)({ level: process.env.LOG_LEVEL || 'info' });
    }
    async start() {
        this.isRunning = true;
        this.logger.info('Starting MEXC scalper');
        try {
            this.db = await (0, db_1.initDatabase)(process.env.DATABASE_PATH || './data/mexc_bot.db');
            this.logger.info('Database initialized');
        }
        catch (e) {
            this.logger.warn({ err: e }, 'Failed to initialize database');
        }
        await this.sendTelegramMessage('*MEXC Scalper Started*\n\nReady for new strategy implementation.');
    }
    async stop() {
        this.isRunning = false;
        await this.sendTelegramMessage('*MEXC Scalper Stopped*');
        this.logger.info('Stopped MEXC scalper');
    }
    // Placeholder for new strategy methods
    // TODO: Implement new trading strategy here
    async sendTelegramMessage(text) {
        try {
            await this.telegramBot.sendMessage(Number(process.env.TELEGRAM_ADMIN_CHAT_IDS), text, { parse_mode: 'Markdown' });
        }
        catch (error) {
            this.logger.error({ err: error }, 'Failed to send Telegram message');
        }
    }
    async logEvent(type, payload) {
        try {
            if (!this.db?.run)
                return;
            await this.db.run('INSERT INTO events (ts, type, payload_json) VALUES (?, ?, ?)', [Date.now(), type, JSON.stringify(payload)]);
        }
        catch (e) {
            this.logger.warn({ err: e }, 'Failed to log event');
        }
    }
}
async function main() {
    try {
        console.log('Starting MEXC scalper...');
        const scalper = new MexcScalper();
        await scalper.start();
        process.on('SIGINT', async () => {
            console.log('SIGINT received, shutting down...');
            await scalper.stop();
            process.exit(0);
        });
        process.on('SIGTERM', async () => {
            console.log('SIGTERM received, shutting down...');
            await scalper.stop();
            process.exit(0);
        });
    }
    catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=main.js.map