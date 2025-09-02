require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const pino = require('pino');
const { MexcRestClient } = require('./dist/infra/mexcRest');

class MexcAutoScalper {
  constructor() {
    this.restClient = new MexcRestClient(process.env.MEXC_API_KEY, process.env.MEXC_SECRET_KEY);
    this.telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
    this.logger = pino({ level: 'info' });
    this.isRunning = false;
    this.lastOrders = [];
    this.totalTrades = 0;
    this.sessionPnL = 0;
    this.lastStatusUpdate = 0;
  }

  async start() {
    try {
      this.isRunning = true;
      this.logger.info('🚀 Мы запустили MEXC Скальпер');

      // Инициализация
      await this.initializeOrders();

      // Уведомление
      await this.sendTelegramMessage(
        '🚀 *Мы запустили MEXC Скальпер*\n\n' +
        '🎯 Автоматический скальпинг активирован!\n' +
        '📊 Мониторинг каждые 30 секунд\n' +
        '🔄 Авто-размещение ордеров\n' +
        '⚡ Уведомления о сделках\n\n' +
        this.getRandomJoke()
      );

      // Основной цикл
      setInterval(async () => {
        try {
          await this.maintainOrders();
        } catch (error) {
          this.logger.error('Ошибка в основном цикле:', error);
        }
      }, 30000);

    } catch (error) {
      this.logger.error('Ошибка запуска:', error);
      throw error;
    }
  }

  async initializeOrders() {
    try {
      const orders = await this.restClient.getOpenOrders('ETH/USDC');
      this.lastOrders = orders;
      this.logger.info(`📊 Инициализировано ${orders.length} активных ордеров`);
    } catch (error) {
      this.logger.error('Ошибка инициализации ордеров:', error);
    }
  }

  async maintainOrders() {
    try {
      const currentOrders = await this.restClient.getOpenOrders('ETH/USDC');
      const currentPrice = await this.restClient.getPrice('ETH/USDC');
      const price = parseFloat(currentPrice);

      // Проверяем изменения
      const buyOrders = currentOrders.filter(o => o.side === 'buy').length;
      const sellOrders = currentOrders.filter(o => o.side === 'sell').length;

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

    } catch (error) {
      this.logger.error('Ошибка поддержания ордеров:', error);
    }
  }

  async placeMissingBuyOrders(currentOrders, price) {
    const existingBuyOrders = currentOrders.filter(o => o.side === 'buy');
    const neededBuyOrders = 4 - existingBuyOrders.length;

    if (neededBuyOrders <= 0) return;

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

        this.logger.info(`🔄 Размещаю buy ордер ${level}: $${roundedPrice} x ${qty}`);

        const result = await this.restClient.placeOrder(
          'ETH/USDC',
          'buy',
          'limit',
          qty,
          roundedPrice,
          clientOrderId
        );

        this.logger.info(`✅ Buy ордер ${level} размещен: ${result.id}`);

        // Небольшая пауза
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        this.logger.error(`❌ Ошибка размещения buy ордера ${level}:`, error.message);
        this.logger.error('   Детали:', error.response?.data);
      }
    }
  }

  async placeMissingSellOrders(currentOrders, price) {
    const existingSellOrders = currentOrders.filter(o => o.side === 'sell');
    const neededSellOrders = 4 - existingSellOrders.length;

    if (neededSellOrders <= 0) return;

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

        this.logger.info(`🔄 Размещаю sell ордер ${level}: $${roundedPrice} x ${qty}`);

        const result = await this.restClient.placeOrder(
          'ETH/USDC',
          'sell',
          'limit',
          qty,
          roundedPrice,
          clientOrderId
        );

        this.logger.info(`✅ Sell ордер ${level} размещен: ${result.id}`);

        // Небольшая пауза
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        this.logger.error(`❌ Ошибка размещения sell ордера ${level}:`, error.message);
        this.logger.error('   Детали:', error.response?.data);
      }
    }
  }

  async sendStatusUpdate(orders) {
    try {
      const buyOrders = orders.filter(o => o.side === 'buy').length;
      const sellOrders = orders.filter(o => o.side === 'sell').length;

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

      message += this.getRandomJoke();

      await this.sendTelegramMessage(message);

    } catch (error) {
      this.logger.error('Ошибка отправки статуса:', error);
    }
  }

  getBalanceMessage() {
    // Простая заглушка - в реальности нужно получать баланс
    return '💰 Баланс: ~90 USDC, ~0.001 ETH';
  }

  getRandomJoke() {
    const jokes = [
      "Васечек, помни: на рынке главное не быть, а казаться! Особенно когда P&L красное. 😉",
      "Почему Васечек не играет в покер? Потому что он всегда 'all-in' на рынке! 🚀",
      "Васечек, инвестируй с умом, а не как в рулетку! 🎰",
      "Васечек, рынок как женщина - непредсказуем, но всегда прав! 💃",
      "Васечек, в трейдинге главное не паниковать, а паниковать стратегически! 😱",
      "Васечек, помни: bulls make money, bears make money, pigs get slaughtered! 🐷",
      "Васечек, рынок не для слабонервных, но для умных! 🧠",
      "Васечек, в трейдинге как в жизни - чем больше учишься, тем меньше теряешь! 📚",
      "Васечек, рынок - это не казино, а бизнес! 💼",
      "Васечек, трейдинг - искусство терять деньги медленно! 🎨"
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
  }

  async sendTelegramMessage(text) {
    try {
      await this.telegramBot.sendMessage(
        process.env.TELEGRAM_ADMIN_CHAT_IDS,
        text,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      this.logger.error('Ошибка отправки в Telegram:', error);
    }
  }
}

// Запуск
async function main() {
  try {
    console.log('�� Запуск MEXC Скальпер...');

    const scalper = new MexcAutoScalper();
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

  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  }
}

main();
