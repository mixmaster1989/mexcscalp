import pino from 'pino';

export class Logger {
  private logger: pino.Logger;

  constructor() {
    this.logger = pino({
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

  info(message: string, data?: any): void {
    this.logger.info(data, message);
  }

  error(message: string, error?: any): void {
    this.logger.error(error, message);
  }

  warn(message: string, data?: any): void {
    this.logger.warn(data, message);
  }

  debug(message: string, data?: any): void {
    this.logger.debug(data, message);
  }

  // Специальные методы для торговых событий
  trade(message: string, data?: any): void {
    this.logger.info(data, `💰 TRADE: ${message}`);
  }

  order(message: string, data?: any): void {
    this.logger.info(data, `📋 ORDER: ${message}`);
  }

  risk(message: string, data?: any): void {
    this.logger.warn(data, `⚠️ RISK: ${message}`);
  }

  pnl(message: string, data?: any): void {
    this.logger.info(data, `💵 PnL: ${message}`);
  }

  stats(message: string, data?: any): void {
    this.logger.info(data, `📊 STATS: ${message}`);
  }
}

export const logger = new Logger();
