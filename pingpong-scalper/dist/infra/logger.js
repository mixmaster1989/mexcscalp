"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = void 0;
const pino_1 = __importDefault(require("pino"));
class Logger {
    constructor() {
        this.logger = (0, pino_1.default)({
            level: 'info',
            transport: {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname'
                }
            }
        });
    }
    info(message, data) {
        this.logger.info(data, message);
    }
    error(message, error) {
        this.logger.error(error, message);
    }
    warn(message, data) {
        this.logger.warn(data, message);
    }
    debug(message, data) {
        this.logger.debug(data, message);
    }
    // Специальные методы для торговых событий
    trade(message, data) {
        this.logger.info(data, `💰 TRADE: ${message}`);
    }
    order(message, data) {
        this.logger.info(data, `📋 ORDER: ${message}`);
    }
    risk(message, data) {
        this.logger.warn(data, `⚠️ RISK: ${message}`);
    }
    pnl(message, data) {
        this.logger.info(data, `💵 PnL: ${message}`);
    }
    stats(message, data) {
        this.logger.info(data, `📊 STATS: ${message}`);
    }
}
exports.Logger = Logger;
exports.logger = new Logger();
//# sourceMappingURL=logger.js.map