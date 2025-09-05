#!/usr/bin/env node
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { MexcRestClient } = require('./dist/infra/mexcRest');

console.log('💰 АНАЛИЗ PnL И ЭФФЕКТИВНОСТИ ТОРГОВЛИ\n');

class PnLAnalyzer {
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

  // Анализ PnL по дням
  async analyzeDailyPnL(days = 30) {
    console.log(`📅 АНАЛИЗ PnL ПО ДНЯМ (последние ${days} дней):`);
    console.log('═'.repeat(70));

    try {
      const dailyStats = await this.query(`
        SELECT 
          DATE(datetime(ts_entry/1000, 'unixepoch')) as date,
          COUNT(*) as trades_count,
          SUM(pnl) as daily_pnl,
          AVG(pnl) as avg_pnl,
          COUNT(CASE WHEN pnl > 0 THEN 1 END) as winning_trades,
          COUNT(CASE WHEN pnl < 0 THEN 1 END) as losing_trades,
          MAX(pnl) as best_trade,
          MIN(pnl) as worst_trade,
          SUM(qty) as total_volume
        FROM trades 
        WHERE ts_entry > strftime('%s', 'now', '-${days} days') * 1000
        GROUP BY date 
        ORDER BY date DESC
      `);

      if (dailyStats.length === 0) {
        console.log('   ℹ️ Нет данных о сделках за указанный период');
        return;
      }

      let totalPnL = 0;
      let totalTrades = 0;
      let totalWinning = 0;
      let totalLosing = 0;
      let bestDayPnL = 0;
      let worstDayPnL = 0;
      let bestDay = '';
      let worstDay = '';

      console.log('📊 Детальная статистика по дням:');
      console.log('Дата       | Сделок | PnL      | Винрейт | Лучшая  | Худшая  | Объем');
      console.log('─'.repeat(70));

      dailyStats.forEach(day => {
        const winRate = day.trades_count > 0 ? (day.winning_trades / day.trades_count * 100) : 0;
        const pnlEmoji = day.daily_pnl >= 0 ? '🟢' : '🔴';
        const pnlFormatted = day.daily_pnl >= 0 ? `+${day.daily_pnl.toFixed(4)}` : day.daily_pnl.toFixed(4);
        
        console.log(`${day.date} | ${day.trades_count.toString().padStart(6)} | ${pnlEmoji} ${pnlFormatted.padStart(8)} | ${winRate.toFixed(1).padStart(6)}% | ${day.best_trade.toFixed(4).padStart(7)} | ${day.worst_trade.toFixed(4).padStart(7)} | ${day.total_volume.toFixed(4)}`);

        totalPnL += day.daily_pnl;
        totalTrades += day.trades_count;
        totalWinning += day.winning_trades;
        totalLosing += day.losing_trades;

        if (day.daily_pnl > bestDayPnL) {
          bestDayPnL = day.daily_pnl;
          bestDay = day.date;
        }
        if (day.daily_pnl < worstDayPnL) {
          worstDayPnL = day.daily_pnl;
          worstDay = day.date;
        }
      });

      const overallWinRate = totalTrades > 0 ? (totalWinning / totalTrades * 100) : 0;
      const avgDailyPnL = totalPnL / dailyStats.length;

      console.log('─'.repeat(70));
      console.log(`ИТОГО      | ${totalTrades.toString().padStart(6)} | ${totalPnL >= 0 ? '🟢' : '🔴'} ${totalPnL.toFixed(4).padStart(8)} | ${overallWinRate.toFixed(1).padStart(6)}% | ${Math.max(...dailyStats.map(d => d.best_trade)).toFixed(4).padStart(7)} | ${Math.min(...dailyStats.map(d => d.worst_trade)).toFixed(4).padStart(7)} | ${dailyStats.reduce((sum, d) => sum + d.total_volume, 0).toFixed(4)}`);

      console.log('\n📈 Сводная статистика:');
      console.log(`   Общий PnL: ${totalPnL >= 0 ? '🟢' : '🔴'} ${totalPnL.toFixed(4)} USDC`);
      console.log(`   Средний PnL в день: ${avgDailyPnL.toFixed(4)} USDC`);
      console.log(`   Общий винрейт: ${overallWinRate.toFixed(2)}%`);
      console.log(`   Лучший день: ${bestDay} (+${bestDayPnL.toFixed(4)} USDC)`);
      console.log(`   Худший день: ${worstDay} (${worstDayPnL.toFixed(4)} USDC)`);
      console.log(`   Прибыльных дней: ${dailyStats.filter(d => d.daily_pnl > 0).length}/${dailyStats.length}`);

    } catch (error) {
      console.error('❌ Ошибка анализа дневного PnL:', error.message);
    }
  }

  // Анализ PnL по часам
  async analyzeHourlyPnL() {
    console.log('\n⏰ АНАЛИЗ PnL ПО ЧАСАМ:');
    console.log('═'.repeat(50));

    try {
      const hourlyStats = await this.query(`
        SELECT 
          strftime('%H', datetime(ts_entry/1000, 'unixepoch')) as hour,
          COUNT(*) as trades_count,
          SUM(pnl) as hourly_pnl,
          AVG(pnl) as avg_pnl,
          COUNT(CASE WHEN pnl > 0 THEN 1 END) as winning_trades
        FROM trades 
        WHERE ts_entry > strftime('%s', 'now', '-30 days') * 1000
        GROUP BY hour 
        ORDER BY hour
      `);

      if (hourlyStats.length === 0) {
        console.log('   ℹ️ Нет данных для анализа по часам');
        return;
      }

      console.log('Час | Сделок | PnL      | Винрейт | Средний PnL');
      console.log('─'.repeat(50));

      hourlyStats.forEach(hour => {
        const winRate = hour.trades_count > 0 ? (hour.winning_trades / hour.trades_count * 100) : 0;
        const pnlEmoji = hour.hourly_pnl >= 0 ? '🟢' : '🔴';
        const pnlFormatted = hour.hourly_pnl >= 0 ? `+${hour.hourly_pnl.toFixed(4)}` : hour.hourly_pnl.toFixed(4);
        
        console.log(`${hour.hour.padStart(3)} | ${hour.trades_count.toString().padStart(6)} | ${pnlEmoji} ${pnlFormatted.padStart(8)} | ${winRate.toFixed(1).padStart(6)}% | ${hour.avg_pnl.toFixed(4).padStart(10)}`);
      });

      // Находим лучшие и худшие часы
      const bestHour = hourlyStats.reduce((best, hour) => hour.hourly_pnl > best.hourly_pnl ? hour : best);
      const worstHour = hourlyStats.reduce((worst, hour) => hour.hourly_pnl < worst.hourly_pnl ? hour : worst);

      console.log('\n🎯 Лучшие и худшие часы:');
      console.log(`   Лучший час: ${bestHour.hour}:00 (+${bestHour.hourly_pnl.toFixed(4)} USDC, ${bestHour.trades_count} сделок)`);
      console.log(`   Худший час: ${worstHour.hour}:00 (${worstHour.hourly_pnl.toFixed(4)} USDC, ${worstHour.trades_count} сделок)`);

    } catch (error) {
      console.error('❌ Ошибка анализа почасового PnL:', error.message);
    }
  }

  // Анализ эффективности стратегий
  async analyzeStrategyPerformance() {
    console.log('\n🎯 АНАЛИЗ ЭФФЕКТИВНОСТИ СТРАТЕГИЙ:');
    console.log('═'.repeat(60));

    try {
      const strategyStats = await this.query(`
        SELECT 
          strategy,
          COUNT(*) as trades_count,
          SUM(pnl) as total_pnl,
          AVG(pnl) as avg_pnl,
          COUNT(CASE WHEN pnl > 0 THEN 1 END) as winning_trades,
          COUNT(CASE WHEN pnl < 0 THEN 1 END) as losing_trades,
          MAX(pnl) as best_trade,
          MIN(pnl) as worst_trade,
          AVG(duration_ms) as avg_duration_ms,
          SUM(qty) as total_volume
        FROM trades 
        GROUP BY strategy 
        ORDER BY total_pnl DESC
      `);

      if (strategyStats.length === 0) {
        console.log('   ℹ️ Нет данных о стратегиях');
        return;
      }

      console.log('Стратегия | Сделок | PnL      | Винрейт | Средний PnL | Лучшая  | Худшая  | Время');
      console.log('─'.repeat(80));

      strategyStats.forEach(strategy => {
        const winRate = strategy.trades_count > 0 ? (strategy.winning_trades / strategy.trades_count * 100) : 0;
        const pnlEmoji = strategy.total_pnl >= 0 ? '🟢' : '🔴';
        const pnlFormatted = strategy.total_pnl >= 0 ? `+${strategy.total_pnl.toFixed(4)}` : strategy.total_pnl.toFixed(4);
        const avgDuration = Math.round(strategy.avg_duration_ms / 1000); // секунды
        
        console.log(`${strategy.strategy.padStart(8)} | ${strategy.trades_count.toString().padStart(6)} | ${pnlEmoji} ${pnlFormatted.padStart(8)} | ${winRate.toFixed(1).padStart(6)}% | ${strategy.avg_pnl.toFixed(4).padStart(10)} | ${strategy.best_trade.toFixed(4).padStart(7)} | ${strategy.worst_trade.toFixed(4).padStart(7)} | ${avgDuration}s`);
      });

      // Рейтинг стратегий
      console.log('\n🏆 РЕЙТИНГ СТРАТЕГИЙ:');
      strategyStats.forEach((strategy, index) => {
        const rank = index + 1;
        const emoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '📊';
        console.log(`   ${emoji} ${rank}. ${strategy.strategy}: ${strategy.total_pnl >= 0 ? '+' : ''}${strategy.total_pnl.toFixed(4)} USDC (${strategy.trades_count} сделок)`);
      });

    } catch (error) {
      console.error('❌ Ошибка анализа стратегий:', error.message);
    }
  }

  // Анализ рисков
  async analyzeRiskMetrics() {
    console.log('\n⚠️ АНАЛИЗ РИСКОВ:');
    console.log('═'.repeat(50));

    try {
      // Максимальная просадка
      const trades = await this.query(`
        SELECT pnl, ts_entry 
        FROM trades 
        ORDER BY ts_entry ASC
      `);

      if (trades.length === 0) {
        console.log('   ℹ️ Нет данных для анализа рисков');
        return;
      }

      let runningPnL = 0;
      let peakPnL = 0;
      let maxDrawdown = 0;
      let currentDrawdown = 0;

      trades.forEach(trade => {
        runningPnL += trade.pnl;
        if (runningPnL > peakPnL) {
          peakPnL = runningPnL;
          currentDrawdown = 0;
        } else {
          currentDrawdown = peakPnL - runningPnL;
          if (currentDrawdown > maxDrawdown) {
            maxDrawdown = currentDrawdown;
          }
        }
      });

      // Волатильность
      const pnlValues = trades.map(t => t.pnl);
      const avgPnL = pnlValues.reduce((sum, p) => sum + p, 0) / pnlValues.length;
      const variance = pnlValues.reduce((sum, p) => sum + Math.pow(p - avgPnL, 2), 0) / pnlValues.length;
      const volatility = Math.sqrt(variance);

      // Коэффициент Шарпа (упрощенный)
      const sharpeRatio = volatility > 0 ? avgPnL / volatility : 0;

      // Анализ серий убытков
      let currentLossStreak = 0;
      let maxLossStreak = 0;
      let currentWinStreak = 0;
      let maxWinStreak = 0;

      trades.forEach(trade => {
        if (trade.pnl < 0) {
          currentLossStreak++;
          currentWinStreak = 0;
          if (currentLossStreak > maxLossStreak) {
            maxLossStreak = currentLossStreak;
          }
        } else if (trade.pnl > 0) {
          currentWinStreak++;
          currentLossStreak = 0;
          if (currentWinStreak > maxWinStreak) {
            maxWinStreak = currentWinStreak;
          }
        }
      });

      console.log('📊 Метрики риска:');
      console.log(`   Максимальная просадка: ${maxDrawdown.toFixed(4)} USDC`);
      console.log(`   Волатильность: ${volatility.toFixed(4)} USDC`);
      console.log(`   Коэффициент Шарпа: ${sharpeRatio.toFixed(4)}`);
      console.log(`   Максимальная серия убытков: ${maxLossStreak} сделок`);
      console.log(`   Максимальная серия прибыли: ${maxWinStreak} сделок`);

      // Оценка риска
      console.log('\n🎯 Оценка риска:');
      if (maxDrawdown > 10) {
        console.log('   ⚠️ Высокий риск: большая максимальная просадка');
      } else if (maxDrawdown > 5) {
        console.log('   ⚡ Средний риск: умеренная просадка');
      } else {
        console.log('   ✅ Низкий риск: небольшая просадка');
      }

      if (volatility > 2) {
        console.log('   ⚠️ Высокая волатильность: нестабильные результаты');
      } else if (volatility > 1) {
        console.log('   ⚡ Средняя волатильность: умеренная стабильность');
      } else {
        console.log('   ✅ Низкая волатильность: стабильные результаты');
      }

      if (maxLossStreak > 10) {
        console.log('   ⚠️ Длинные серии убытков: возможны проблемы с управлением рисками');
      } else {
        console.log('   ✅ Короткие серии убытков: хорошее управление рисками');
      }

    } catch (error) {
      console.error('❌ Ошибка анализа рисков:', error.message);
    }
  }

  // Анализ комиссий
  async analyzeFees() {
    console.log('\n💸 АНАЛИЗ КОМИССИЙ:');
    console.log('═'.repeat(50));

    try {
      const feeStats = await this.query(`
        SELECT 
          SUM(fee) as total_fees,
          AVG(fee) as avg_fee,
          COUNT(*) as total_fills,
          SUM(qty * price) as total_volume_usd
        FROM fills
      `);

      if (feeStats.length === 0 || !feeStats[0].total_fees) {
        console.log('   ℹ️ Нет данных о комиссиях');
        return;
      }

      const stats = feeStats[0];
      const feeRate = stats.total_volume_usd > 0 ? (stats.total_fees / stats.total_volume_usd * 100) : 0;

      console.log('📊 Статистика комиссий:');
      console.log(`   Общие комиссии: ${stats.total_fees.toFixed(4)} USDC`);
      console.log(`   Средняя комиссия: ${stats.avg_fee.toFixed(4)} USDC`);
      console.log(`   Всего исполнений: ${stats.total_fills}`);
      console.log(`   Общий объем торгов: ${stats.total_volume_usd.toFixed(2)} USDC`);
      console.log(`   Средняя ставка комиссии: ${feeRate.toFixed(4)}%`);

      // Сравнение с PnL
      const pnlStats = await this.getOne(`
        SELECT SUM(pnl) as total_pnl 
        FROM trades
      `);

      if (pnlStats && pnlStats.total_pnl) {
        const netPnL = pnlStats.total_pnl - stats.total_fees;
        const feeImpact = stats.total_fees / Math.abs(pnlStats.total_pnl) * 100;

        console.log('\n💰 Влияние комиссий на PnL:');
        console.log(`   Валовая прибыль: ${pnlStats.total_pnl.toFixed(4)} USDC`);
        console.log(`   Комиссии: ${stats.total_fees.toFixed(4)} USDC`);
        console.log(`   Чистая прибыль: ${netPnL.toFixed(4)} USDC`);
        console.log(`   Влияние комиссий: ${feeImpact.toFixed(2)}% от валовой прибыли`);

        if (feeImpact > 50) {
          console.log('   ⚠️ Высокое влияние комиссий на прибыль');
        } else if (feeImpact > 20) {
          console.log('   ⚡ Умеренное влияние комиссий');
        } else {
          console.log('   ✅ Низкое влияние комиссий');
        }
      }

    } catch (error) {
      console.error('❌ Ошибка анализа комиссий:', error.message);
    }
  }

  async run() {
    try {
      await this.connectDB();
      await this.analyzeDailyPnL();
      await this.analyzeHourlyPnL();
      await this.analyzeStrategyPerformance();
      await this.analyzeRiskMetrics();
      await this.analyzeFees();
    } catch (error) {
      console.error('❌ Критическая ошибка:', error.message);
    } finally {
      await this.closeDB();
    }
  }
}

// Запуск анализа
const analyzer = new PnLAnalyzer();
analyzer.run();


