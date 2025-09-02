import TelegramBot from 'node-telegram-bot-api';
import { EventEmitter } from 'events';
import pino from 'pino';
import { TradingStats, SystemStatus } from './types';
import { Fill, MarketRegime } from '../core/types';
const { getRandomJoke } = require('../../jokes');

/**
 * Простой Telegram бот без авторизации - просто шлет уведомления в группу
 * Теперь с шутками для Васечка и командным стилем "мы"
 */
export class MexcTelegramBot extends EventEmitter {
  private bot: TelegramBot;
  private logger: pino.Logger;
  private groupChatId: number;
  private getTradingStats: () => TradingStats;
  private getSystemStatus: () => SystemStatus;
  private onTradingCommand: (command: string, chatId: number) => Promise<string>;
  
  private isRunning: boolean = false;
  private startTime: number = Date.now();
  private messageCount: number = 0;
  private jokeCount: number = 0;

  constructor(
    token: string,
    groupChatId: number,
    getTradingStats: () => TradingStats,
    getSystemStatus: () => SystemStatus,
    onTradingCommand: (command: string, chatId: number) => Promise<string>,
    logger: pino.Logger
  ) {
    super();
    
    this.logger = logger;
    this.bot = new TelegramBot(token, { polling: true });
    this.groupChatId = groupChatId;
    this.getTradingStats = getTradingStats;
    this.getSystemStatus = getSystemStatus;
    this.onTradingCommand = onTradingCommand;
    
    this.setupEventHandlers();
  }

  /**
   * Запустить бота
   */
  async start(): Promise<void> {
    try {
      this.isRunning = true;
      this.startTime = Date.now();
      
      this.logger.info('🤖 Мы запустили Telegram бота');
      
      // Уведомляем в группу о запуске
      await this.sendMessage('🚀 *Мы запустили MEXC Scalp Bot*\n\nСистема готова к торговле!\n\n' + getRandomJoke());
      
    } catch (error) {
      this.logger.error('Ошибка запуска Telegram бота:', error);
      throw error;
    }
  }

  /**
   * Остановить бота
   */
  async stop(): Promise<void> {
    try {
      this.isRunning = false;
      
      await this.sendMessage('⏹️ *Мы остановили MEXC Scalp Bot*\n\nСистема остановлена для обслуживания.\n\n' + getRandomJoke());
      await this.bot.stopPolling();
      
      this.logger.info('🤖 Мы остановили Telegram бота');
      
    } catch (error) {
      this.logger.error('Ошибка остановки Telegram бота:', error);
    }
  }

  /**
   * Настроить обработчики событий
   */
  private setupEventHandlers(): void {
    this.bot.on('message', async (msg) => {
      try {
        await this.handleMessage(msg);
      } catch (error) {
        this.logger.error('Ошибка обработки сообщения:', error);
      }
    });

    this.bot.on('error', (error) => {
      this.logger.error('Ошибка Telegram бота:', error);
    });

    this.bot.on('polling_error', (error) => {
      this.logger.error('Ошибка polling:', error);
    });
  }

  /**
   * Обработать сообщение
   */
  private async handleMessage(msg: TelegramBot.Message): Promise<void> {
    if (!msg.text) return;
    
    const chatId = msg.chat.id;
    const text = msg.text.toLowerCase();
    
    try {
      if (text === '/start') {
        await this.bot.sendMessage(chatId, '👋 Привет! Мы - команда MEXC Scalp Bot!\n\nМы торгуем ETH/USDC автоматически.\n\n' + getRandomJoke());
      } else if (text === '/status') {
        await this.handleStatusCommand(chatId);
      } else if (text === '/stats') {
        await this.handleStatsCommand(chatId);
      } else if (text.startsWith('/')) {
        const command = text.substring(1);
        const response = await this.onTradingCommand(command, chatId);
        await this.bot.sendMessage(chatId, response + '\n\n' + getRandomJoke());
      }
    } catch (error) {
      await this.bot.sendMessage(chatId, `❌ Ошибка: ${error}`);
    }
  }

  /**
   * Обработать команду статуса
   */
  private async handleStatusCommand(chatId: number): Promise<void> {
    const status = this.getSystemStatus();
    
    const message = `
🤖 *Статус нашей системы*

*Система:* ${this.getStatusIcon(status.systemStatus)} \`${status.systemStatus}\`
*Торговля:* ${this.getStatusIcon(status.tradingEnabled ? 'active' : 'stopped')} \`${status.tradingEnabled ? 'ВКЛЮЧЕНА' : 'ОТКЛЮЧЕНА'}\`
*Баланс:* \$${status.totalBalance.toFixed(2)}
*Время работы:* ${this.formatUptime(Date.now() - this.startTime)}

*Время:* ${this.formatTime(Date.now())}
    `;

    await this.bot.sendMessage(chatId, message + '\n\n' + getRandomJoke());
  }

  /**
   * Обработать команду статистики
   */
  private async handleStatsCommand(chatId: number): Promise<void> {
    const stats = this.getTradingStats();
    
    const message = `
📊 *Наша торговая статистика*

*Всего сделок:* \`${stats.totalTrades}\`
*Прибыльных:* \`${stats.profitableTrades}\`
*Убыточных:* \`${stats.losingTrades}\`
*Win Rate:* \`${stats.winRate.toFixed(1)}%\`
*Общая P&L:* \$${stats.totalPnL.toFixed(2)}
*P&L сегодня:* \$${stats.dailyPnL.toFixed(2)}
*Макс. просадка:* \$${stats.maxDrawdown.toFixed(2)}

*Время:* ${this.formatTime(Date.now())}
    `;

    await this.bot.sendMessage(chatId, message + '\n\n' + getRandomJoke());
  }

  /**
   * Отправить сообщение в группу
   */
  async sendMessage(message: string): Promise<void> {
    try {
      this.messageCount++;
      await this.bot.sendMessage(this.groupChatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.error('Ошибка отправки сообщения:', error);
    }
  }

  /**
   * Уведомление о сделке
   */
  async notifyTrade(fill: Fill): Promise<void> {
    this.jokeCount++;
    const sideIcon = fill.side === 'buy' ? '🟢' : '🔴';
    const message = `
${sideIcon} *Мы совершили сделку ${fill.side.toUpperCase()}*

*Цена:* \`$${fill.price.toFixed(4)}\`
*Количество:* \`${fill.quantity.toFixed(6)} ETH\`
*Сумма:* \`$${(fill.price * fill.quantity).toFixed(2)}\`
*Время:* ${this.formatTime(fill.timestamp)}
    `;

    // Добавляем шутку каждые 3 сообщения для Васечка
    const joke = this.jokeCount % 3 === 0 ? '\n\n' + getRandomJoke() : '';
    
    await this.sendMessage(message + joke);
  }

  /**
   * Уведомление об изменении режима
   */
  async notifyRegimeChange(previous: MarketRegime, current: MarketRegime, confidence: number): Promise<void> {
    const regimeIcons = { quiet: '🌙', normal: '☀️', shock: '⚡' };
    
    const message = `
${regimeIcons[current]} *Мы изменили режим рынка*

*Предыдущий:* \`${previous}\` ${regimeIcons[previous]}
*Новый:* \`${current}\` ${regimeIcons[current]}
*Уверенность:* \`${(confidence * 100).toFixed(1)}%\`
*Время:* ${this.formatTime(Date.now())}
    `;

    await this.sendMessage(message + '\n\n' + getRandomJoke());
  }

  /**
   * Уведомление об ошибке
   */
  async notifyError(error: Error, context: string): Promise<void> {
    const message = `
❌ *У нас системная ошибка*

*Контекст:* \`${context}\`
*Ошибка:* \`${error.message}\`
*Время:* ${this.formatTime(Date.now())}
    `;

    await this.sendMessage(message + '\n\n' + getRandomJoke());
  }

  /**
   * Критическое уведомление
   */
  async notifyCritical(title: string, text: string): Promise<void> {
    const message = `
🚨 *${title}*

${text}

*Время:* ${this.formatTime(Date.now())}
    `;

    await this.sendMessage(message + '\n\n' + getRandomJoke());
  }

  /**
   * Системное уведомление
   */
  async notifySystem(title: string, text: string): Promise<void> {
    const message = `
🤖 *${title}*

${text}

*Время:* ${this.formatTime(Date.now())}
    `;

    await this.sendMessage(message + '\n\n' + getRandomJoke());
  }

  /**
   * Получить иконку статуса
   */
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'running':
      case 'active':
        return '✅';
      case 'stopped':
      case 'paused':
        return '⏸';
      case 'error':
        return '❌';
      default:
        return '⚪';
    }
  }

  /**
   * Форматировать время работы
   */
  private formatUptime(uptimeMs: number): string {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}д ${hours % 24}ч`;
    } else if (hours > 0) {
      return `${hours}ч ${minutes % 60}м`;
    } else {
      return `${minutes}м`;
    }
  }

  /**
   * Форматировать время
   */
  private formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Проверить, запущен ли бот
   */
  isBotRunning(): boolean {
    return this.isRunning;
  }
}
