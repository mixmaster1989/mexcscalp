import 'dotenv/config';
import { MexcRestClient } from './infra/mexcRest';
import TelegramBot from 'node-telegram-bot-api';
import { initDatabase } from './storage/db';
import pino from 'pino';

class MexcScalper {
  private restClient: any;
  private telegramBot: TelegramBot;
  private logger: pino.Logger;
  private db: any | null = null;
  private isRunning = false;

  constructor() {
    this.restClient = new MexcRestClient(
      process.env.MEXC_API_KEY!,
      process.env.MEXC_SECRET_KEY!
    );
    this.telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: false });
    this.logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.logger.info('Starting MEXC scalper');
    
    try {
      this.db = await initDatabase(process.env.DATABASE_PATH || './data/mexc_bot.db');
      this.logger.info('Database initialized');
    } catch (e) {
      this.logger.warn({ err: e }, 'Failed to initialize database');
    }
    
    await this.sendTelegramMessage('*MEXC Scalper Started*\n\nReady for new strategy implementation.');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.sendTelegramMessage('*MEXC Scalper Stopped*');
    this.logger.info('Stopped MEXC scalper');
  }

  // Placeholder for new strategy methods
  // TODO: Implement new trading strategy here

  private async sendTelegramMessage(text: string): Promise<void> {
    try {
      await this.telegramBot.sendMessage(
        Number(process.env.TELEGRAM_ADMIN_CHAT_IDS!),
        text,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to send Telegram message');
    }
  }

  private async logEvent(type: string, payload: any): Promise<void> {
    try {
      if (!this.db?.run) return;
      await this.db.run('INSERT INTO events (ts, type, payload_json) VALUES (?, ?, ?)', [Date.now(), type, JSON.stringify(payload)]);
    } catch (e) {
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
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();