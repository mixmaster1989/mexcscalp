#!/usr/bin/env node
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { MexcRestClient } = require('./dist/infra/mexcRest');

console.log('📊 СТАТИСТИКА ОРДЕРОВ MEXC SCALPER\n');

class OrderStatsAnalyzer {
  constructor() {
    this.db = null;
    this.client = new MexcRestClient(process.env.MEXC_API_KEY, process.env.MEXC_SECRET_KEY);
  }

  async connectDB() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database('./data/mexc_bot.db', (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async closeDB() {
    if (this.db) {
      return new Promise((resolve) => {
        this.db.close(resolve);
      });
    }
  }

  async query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  async getOne(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Анализ ордеров из базы данных
  async analyzeDatabaseOrders() {
    console.log('🗄️ АНАЛИЗ ОРДЕРОВ ИЗ БАЗЫ ДАННЫХ:');
    console.log('═'.repeat(60));

    try {
      // Общая статистика по таблицам
      const stats = await this.getOne(`
        SELECT 
          (SELECT COUNT(*) FROM orders) as total_orders,
          (SELECT COUNT(*) FROM fills) as total_fills,
          (SELECT COUNT(*) FROM trades) as total_trades,
          (SELECT COUNT(*) FROM events) as total_events
      `);

      console.log(`📊 Общая статистика:`);
      console.log(`   Ордеров в БД: ${stats.total_orders}`);
      console.log(`   Исполнений: ${stats.total_fills}`);
      console.log(`   Сделок: ${stats.total_trades}`);
      console.log(`   Событий: ${stats.total_events}\n`);

      // Статистика по статусам ордеров
      const orderStatuses = await this.query(`
        SELECT status, COUNT(*) as count 
        FROM orders 
        GROUP BY status 
        ORDER BY count DESC
      `);

      console.log('📈 Статусы ордеров:');
      orderStatuses.forEach(row => {
        const emoji = row.status === 'FILLED' ? '✅' : 
                     row.status === 'CANCELED' ? '❌' : 
                     row.status === 'NEW' ? '⏳' : '❓';
        console.log(`   ${emoji} ${row.status}: ${row.count}`);
      });

      // Статистика по сторонам ордеров
      const orderSides = await this.query(`
        SELECT side, COUNT(*) as count 
        FROM orders 
        GROUP BY side 
        ORDER BY count DESC
      `);

      console.log('\n📊 Стороны ордеров:');
      orderSides.forEach(row => {
        const emoji = row.side === 'BUY' ? '🟢' : '🔴';
        console.log(`   ${emoji} ${row.side}: ${row.count}`);
      });

      // Статистика по символам
      const symbols = await this.query(`
        SELECT symbol, COUNT(*) as count 
        FROM orders 
        GROUP BY symbol 
        ORDER BY count DESC
      `);

      console.log('\n💰 Символы:');
      symbols.forEach(row => {
        console.log(`   ${row.symbol}: ${row.count} ордеров`);
      });

      // Анализ по времени
      const timeStats = await this.query(`
        SELECT 
          DATE(datetime(ts_open/1000, 'unixepoch')) as date,
          COUNT(*) as orders_count,
          COUNT(CASE WHEN status = 'FILLED' THEN 1 END) as filled_count,
          COUNT(CASE WHEN status = 'CANCELED' THEN 1 END) as canceled_count
        FROM orders 
        WHERE ts_open > strftime('%s', 'now', '-30 days') * 1000
        GROUP BY date 
        ORDER BY date DESC
        LIMIT 10
      `);

      console.log('\n📅 Активность по дням (последние 10 дней):');
      timeStats.forEach(row => {
        const fillRate = row.orders_count > 0 ? (row.filled_count / row.orders_count * 100).toFixed(1) : 0;
        console.log(`   ${row.date}: ${row.orders_count} ордеров (${row.filled_count} исполнено, ${row.canceled_count} отменено, ${fillRate}% исполнение)`);
      });

      // Анализ исполнений
      if (stats.total_fills > 0) {
        const fillStats = await this.getOne(`
          SELECT 
            COUNT(*) as total_fills,
            SUM(qty) as total_volume,
            AVG(price) as avg_price,
            SUM(fee) as total_fees,
            MIN(ts) as first_fill,
            MAX(ts) as last_fill
          FROM fills
        `);

        console.log('\n💸 Статистика исполнений:');
        console.log(`   Всего исполнений: ${fillStats.total_fills}`);
        console.log(`   Общий объем: ${fillStats.total_volume?.toFixed(6) || 0} ETH`);
        console.log(`   Средняя цена: ${fillStats.avg_price?.toFixed(2) || 0} USDC`);
        console.log(`   Общие комиссии: ${fillStats.total_fees?.toFixed(4) || 0} USDC`);
        
        if (fillStats.first_fill && fillStats.last_fill) {
          const firstDate = new Date(fillStats.first_fill).toLocaleDateString('ru-RU');
          const lastDate = new Date(fillStats.last_fill).toLocaleDateString('ru-RU');
          console.log(`   Первое исполнение: ${firstDate}`);
          console.log(`   Последнее исполнение: ${lastDate}`);
        }
      }

      // Анализ сделок
      if (stats.total_trades > 0) {
        const tradeStats = await this.getOne(`
          SELECT 
            COUNT(*) as total_trades,
            SUM(pnl) as total_pnl,
            AVG(pnl) as avg_pnl,
            COUNT(CASE WHEN pnl > 0 THEN 1 END) as winning_trades,
            COUNT(CASE WHEN pnl < 0 THEN 1 END) as losing_trades,
            MAX(pnl) as best_trade,
            MIN(pnl) as worst_trade
          FROM trades
        `);

        const winRate = tradeStats.total_trades > 0 ? (tradeStats.winning_trades / tradeStats.total_trades * 100) : 0;

        console.log('\n🎯 Статистика сделок:');
        console.log(`   Всего сделок: ${tradeStats.total_trades}`);
        console.log(`   Общий PnL: ${tradeStats.total_pnl >= 0 ? '🟢' : '🔴'} ${tradeStats.total_pnl?.toFixed(4) || 0} USDC`);
        console.log(`   Средний PnL: ${tradeStats.avg_pnl?.toFixed(4) || 0} USDC`);
        console.log(`   Прибыльных: ${tradeStats.winning_trades}`);
        console.log(`   Убыточных: ${tradeStats.losing_trades}`);
        console.log(`   Винрейт: ${winRate.toFixed(2)}%`);
        console.log(`   Лучшая сделка: 🟢 +${tradeStats.best_trade?.toFixed(4) || 0} USDC`);
        console.log(`   Худшая сделка: 🔴 ${tradeStats.worst_trade?.toFixed(4) || 0} USDC`);
      }

    } catch (error) {
      console.error('❌ Ошибка анализа БД:', error.message);
    }
  }

  // Анализ активных ордеров через API
  async analyzeActiveOrders() {
    console.log('\n🌐 АНАЛИЗ АКТИВНЫХ ОРДЕРОВ ЧЕРЕЗ API:');
    console.log('═'.repeat(60));

    try {
      // Получаем активные ордера
      const openOrders = await this.client.getOpenOrders('ETHUSDC');
      
      console.log(`📊 Активных ордеров: ${openOrders.length}`);

      if (openOrders.length === 0) {
        console.log('   ℹ️ Нет активных ордеров');
        return;
      }

      // Группируем по сторонам
      const buyOrders = openOrders.filter(o => o.side === 'buy');
      const sellOrders = openOrders.filter(o => o.side === 'sell');

      console.log(`   🟢 BUY ордеров: ${buyOrders.length}`);
      console.log(`   🔴 SELL ордеров: ${sellOrders.length}`);

      // Анализируем цены
      const prices = openOrders.map(o => parseFloat(o.price));
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

      console.log(`\n💰 Анализ цен активных ордеров:`);
      console.log(`   Минимальная: ${minPrice.toFixed(2)} USDC`);
      console.log(`   Максимальная: ${maxPrice.toFixed(2)} USDC`);
      console.log(`   Средняя: ${avgPrice.toFixed(2)} USDC`);
      console.log(`   Диапазон: ${(maxPrice - minPrice).toFixed(2)} USDC`);

      // Анализируем объемы
      const volumes = openOrders.map(o => parseFloat(o.quantity));
      const totalVolume = volumes.reduce((sum, v) => sum + v, 0);
      const avgVolume = totalVolume / volumes.length;

      console.log(`\n📏 Анализ объемов:`);
      console.log(`   Общий объем: ${totalVolume.toFixed(6)} ETH`);
      console.log(`   Средний объем: ${avgVolume.toFixed(6)} ETH`);

      // Анализируем возраст ордеров
      const now = Date.now();
      const orderAges = openOrders.map(o => {
        const age = Math.floor((now - o.timestamp) / 1000 / 60); // минуты
        return { ...o, age };
      });

      const avgAge = orderAges.reduce((sum, o) => sum + o.age, 0) / orderAges.length;
      const oldestOrder = orderAges.reduce((oldest, o) => o.age > oldest.age ? o : oldest);

      console.log(`\n⏰ Анализ возраста ордеров:`);
      console.log(`   Средний возраст: ${avgAge.toFixed(1)} минут`);
      console.log(`   Самый старый: ${oldestOrder.age} минут (${oldestOrder.side} ${oldestOrder.price})`);

      // Показываем детали ордеров
      console.log(`\n📋 Детали активных ордеров:`);
      openOrders.forEach((order, i) => {
        const age = Math.floor((now - order.timestamp) / 1000 / 60);
        const side = order.side === 'buy' ? '🟢 BUY' : '🔴 SELL';
        console.log(`   ${i + 1}. ${side} ${order.price} x ${order.quantity} (${age} мин)`);
      });

      // Получаем текущую рыночную цену для сравнения
      try {
        const ticker = await this.client.getBookTicker('ETHUSDC');
        const currentPrice = (parseFloat(ticker.bidPrice) + parseFloat(ticker.askPrice)) / 2;
        
        console.log(`\n📊 Сравнение с рынком:`);
        console.log(`   Текущая цена: ${currentPrice.toFixed(2)} USDC`);
        console.log(`   Bid: ${ticker.bidPrice} USDC`);
        console.log(`   Ask: ${ticker.askPrice} USDC`);
        console.log(`   Спред: ${(parseFloat(ticker.askPrice) - parseFloat(ticker.bidPrice)).toFixed(2)} USDC`);

        // Анализируем расстояние ордеров от рынка
        const buyOrdersFromMarket = buyOrders.map(o => {
          const distance = currentPrice - parseFloat(o.price);
          const distancePercent = (distance / currentPrice * 100);
          return { ...o, distance, distancePercent };
        });

        const sellOrdersFromMarket = sellOrders.map(o => {
          const distance = parseFloat(o.price) - currentPrice;
          const distancePercent = (distance / currentPrice * 100);
          return { ...o, distance, distancePercent };
        });

        if (buyOrdersFromMarket.length > 0) {
          const avgBuyDistance = buyOrdersFromMarket.reduce((sum, o) => sum + o.distancePercent, 0) / buyOrdersFromMarket.length;
          console.log(`   Среднее расстояние BUY ордеров: ${avgBuyDistance.toFixed(2)}% от рынка`);
        }

        if (sellOrdersFromMarket.length > 0) {
          const avgSellDistance = sellOrdersFromMarket.reduce((sum, o) => sum + o.distancePercent, 0) / sellOrdersFromMarket.length;
          console.log(`   Среднее расстояние SELL ордеров: ${avgSellDistance.toFixed(2)}% от рынка`);
        }

      } catch (error) {
        console.log('   ⚠️ Не удалось получить рыночные данные');
      }

    } catch (error) {
      console.error('❌ Ошибка анализа активных ордеров:', error.message);
    }
  }

  // Анализ баланса
  async analyzeBalance() {
    console.log('\n💰 АНАЛИЗ БАЛАНСА:');
    console.log('═'.repeat(60));

    try {
      const account = await this.client.getAccountInfo();
      const eth = account.balances.find(b => b.asset === 'ETH');
      const usdc = account.balances.find(b => b.asset === 'USDC');

      console.log('💵 Текущий баланс:');
      console.log(`   🪙 ETH свободно: ${eth?.free || 0}`);
      console.log(`   🔒 ETH заблокировано: ${eth?.locked || 0}`);
      console.log(`   💵 USDC свободно: ${usdc?.free || 0}`);
      console.log(`   🔒 USDC заблокировано: ${usdc?.locked || 0}`);

      const totalEth = parseFloat(eth?.free || 0) + parseFloat(eth?.locked || 0);
      const totalUsdc = parseFloat(usdc?.free || 0) + parseFloat(usdc?.locked || 0);

      console.log(`\n📊 Общие суммы:`);
      console.log(`   ETH всего: ${totalEth.toFixed(6)}`);
      console.log(`   USDC всего: ${totalUsdc.toFixed(2)}`);

      // Проверяем готовность к торговле
      const hasEthForSelling = parseFloat(eth?.free || 0) > 0.0001;
      const hasUsdcForBuying = parseFloat(usdc?.free || 0) > 10;

      console.log(`\n✅ Готовность к торговле:`);
      console.log(`   ETH для продажи: ${hasEthForSelling ? '✅ ЕСТЬ' : '❌ НЕТ'}`);
      console.log(`   USDC для покупки: ${hasUsdcForBuying ? '✅ ЕСТЬ' : '❌ НЕТ'}`);

    } catch (error) {
      console.error('❌ Ошибка анализа баланса:', error.message);
    }
  }

  // Общие выводы
  async generateSummary() {
    console.log('\n🎯 ОБЩИЕ ВЫВОДЫ:');
    console.log('═'.repeat(60));

    try {
      // Получаем последние события
      const recentEvents = await this.query(`
        SELECT type, COUNT(*) as count 
        FROM events 
        WHERE ts > strftime('%s', 'now', '-1 day') * 1000
        GROUP BY type 
        ORDER BY count DESC
      `);

      if (recentEvents.length > 0) {
        console.log('📈 Активность за последние 24 часа:');
        recentEvents.forEach(event => {
          console.log(`   ${event.type}: ${event.count} событий`);
        });
      }

      // Проверяем состояние системы
      const lastOrder = await this.getOne(`
        SELECT ts_open, status, side, symbol 
        FROM orders 
        ORDER BY ts_open DESC 
        LIMIT 1
      `);

      if (lastOrder) {
        const lastOrderTime = new Date(lastOrder.ts_open).toLocaleString('ru-RU');
        console.log(`\n⏰ Последний ордер: ${lastOrderTime} (${lastOrder.status} ${lastOrder.side} ${lastOrder.symbol})`);
      }

      // Рекомендации
      console.log('\n💡 РЕКОМЕНДАЦИИ:');
      
      const openOrders = await this.client.getOpenOrders('ETHUSDC');
      if (openOrders.length === 0) {
        console.log('   ⚠️ Нет активных ордеров - рассмотрите запуск стратегии');
      } else if (openOrders.length < 4) {
        console.log('   ⚠️ Мало активных ордеров - возможно стоит добавить больше уровней');
      } else {
        console.log('   ✅ Достаточно активных ордеров');
      }

      const account = await this.client.getAccountInfo();
      const eth = account.balances.find(b => b.asset === 'ETH');
      const usdc = account.balances.find(b => b.asset === 'USDC');

      if (parseFloat(eth?.free || 0) < 0.001 && parseFloat(usdc?.free || 0) < 50) {
        console.log('   ⚠️ Недостаточно средств для активной торговли');
      } else {
        console.log('   ✅ Достаточно средств для торговли');
      }

    } catch (error) {
      console.error('❌ Ошибка генерации выводов:', error.message);
    }
  }

  async run() {
    try {
      await this.connectDB();
      await this.analyzeDatabaseOrders();
      await this.analyzeActiveOrders();
      await this.analyzeBalance();
      await this.generateSummary();
    } catch (error) {
      console.error('❌ Критическая ошибка:', error.message);
    } finally {
      await this.closeDB();
    }
  }
}

// Запуск анализа
const analyzer = new OrderStatsAnalyzer();
analyzer.run();


