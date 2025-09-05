#!/usr/bin/env node
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { MexcRestClient } = require('./dist/infra/mexcRest');

console.log('⚡ БЫСТРЫЙ ОТЧЕТ О СОСТОЯНИИ СИСТЕМЫ\n');

class QuickReport {
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

  async run() {
    try {
      await this.connectDB();

      // Статистика из БД
      const dbStats = await this.getOne(`
        SELECT 
          (SELECT COUNT(*) FROM orders) as orders,
          (SELECT COUNT(*) FROM fills) as fills,
          (SELECT COUNT(*) FROM trades) as trades,
          (SELECT COUNT(*) FROM events) as events
      `);

      // Последнее событие
      const lastEvent = await this.getOne(`
        SELECT type, datetime(ts/1000, 'unixepoch') as time
        FROM events 
        ORDER BY ts DESC 
        LIMIT 1
      `);

      // Активные ордера через API
      const openOrders = await this.client.getOpenOrders('ETHUSDC');
      
      // Баланс
      const account = await this.client.getAccountInfo();
      const eth = account.balances.find(b => b.asset === 'ETH');
      const usdc = account.balances.find(b => b.asset === 'USDC');

      // Рыночная цена
      const ticker = await this.client.getBookTicker('ETHUSDC');
      const currentPrice = (parseFloat(ticker.bidPrice) + parseFloat(ticker.askPrice)) / 2;

      console.log('📊 СТАТУС СИСТЕМЫ:');
      console.log('═'.repeat(40));
      console.log(`🗄️ База данных:`);
      console.log(`   Ордеров: ${dbStats.orders}`);
      console.log(`   Исполнений: ${dbStats.fills}`);
      console.log(`   Сделок: ${dbStats.trades}`);
      console.log(`   Событий: ${dbStats.events}`);
      
      if (lastEvent) {
        console.log(`   Последнее событие: ${lastEvent.type} (${lastEvent.time})`);
      }

      console.log(`\n🌐 Активные ордера: ${openOrders.length}`);
      console.log(`   BUY: ${openOrders.filter(o => o.side === 'buy').length}`);
      console.log(`   SELL: ${openOrders.filter(o => o.side === 'sell').length}`);

      console.log(`\n💰 Баланс:`);
      console.log(`   ETH: ${eth?.free || 0} (заблокировано: ${eth?.locked || 0})`);
      console.log(`   USDC: ${usdc?.free || 0} (заблокировано: ${usdc?.locked || 0})`);

      console.log(`\n📈 Рынок:`);
      console.log(`   Цена ETH: ${currentPrice.toFixed(2)} USDC`);
      console.log(`   Спред: ${(parseFloat(ticker.askPrice) - parseFloat(ticker.bidPrice)).toFixed(2)} USDC`);

      // Оценка состояния
      console.log(`\n🎯 ОЦЕНКА СОСТОЯНИЯ:`);
      
      const hasActiveOrders = openOrders.length > 0;
      const hasFunds = (parseFloat(eth?.free || 0) > 0.001) || (parseFloat(usdc?.free || 0) > 10);
      const hasRecentActivity = lastEvent && (Date.now() - new Date(lastEvent.time).getTime()) < 24 * 60 * 60 * 1000;

      if (hasActiveOrders && hasFunds && hasRecentActivity) {
        console.log('   ✅ Система работает нормально');
      } else {
        console.log('   ⚠️ Требуется внимание:');
        if (!hasActiveOrders) console.log('     - Нет активных ордеров');
        if (!hasFunds) console.log('     - Недостаточно средств');
        if (!hasRecentActivity) console.log('     - Нет недавней активности');
      }

      // Рекомендации
      console.log(`\n💡 РЕКОМЕНДАЦИИ:`);
      if (openOrders.length < 4) {
        console.log('   - Добавить больше ордеров для лучшего покрытия');
      }
      if (parseFloat(eth?.free || 0) < 0.01 && parseFloat(usdc?.free || 0) < 50) {
        console.log('   - Пополнить баланс для активной торговли');
      }
      if (dbStats.trades === 0) {
        console.log('   - Система готова к торговле, но сделок пока нет');
      }

    } catch (error) {
      console.error('❌ Ошибка получения отчета:', error.message);
    } finally {
      await this.closeDB();
    }
  }
}

// Запуск отчета
const report = new QuickReport();
report.run();


