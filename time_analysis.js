#!/usr/bin/env node
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { MexcRestClient } = require('./dist/infra/mexcRest');

console.log('⏰ АНАЛИЗ ПО ВРЕМЕННЫМ ПЕРИОДАМ\n');

class TimeAnalysisAnalyzer {
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

  // Анализ активности по дням недели
  async analyzeDayOfWeek() {
    console.log('📅 АНАЛИЗ АКТИВНОСТИ ПО ДНЯМ НЕДЕЛИ:');
    console.log('═'.repeat(60));

    try {
      const dayStats = await this.query(`
        SELECT 
          CASE strftime('%w', datetime(ts_entry/1000, 'unixepoch'))
            WHEN '0' THEN 'Воскресенье'
            WHEN '1' THEN 'Понедельник'
            WHEN '2' THEN 'Вторник'
            WHEN '3' THEN 'Среда'
            WHEN '4' THEN 'Четверг'
            WHEN '5' THEN 'Пятница'
            WHEN '6' THEN 'Суббота'
          END as day_name,
          strftime('%w', datetime(ts_entry/1000, 'unixepoch')) as day_num,
          COUNT(*) as trades_count,
          SUM(pnl) as total_pnl,
          AVG(pnl) as avg_pnl,
          COUNT(CASE WHEN pnl > 0 THEN 1 END) as winning_trades,
          AVG(duration_ms) as avg_duration_ms
        FROM trades 
        GROUP BY day_num, day_name
        ORDER BY day_num
      `);

      if (dayStats.length === 0) {
        console.log('   ℹ️ Нет данных для анализа по дням недели');
        return;
      }

      console.log('День недели  | Сделок | PnL      | Винрейт | Средний PnL | Время');
      console.log('─'.repeat(70));

      dayStats.forEach(day => {
        const winRate = day.trades_count > 0 ? (day.winning_trades / day.trades_count * 100) : 0;
        const pnlEmoji = day.total_pnl >= 0 ? '🟢' : '🔴';
        const pnlFormatted = day.total_pnl >= 0 ? `+${day.total_pnl.toFixed(4)}` : day.total_pnl.toFixed(4);
        const avgDuration = Math.round(day.avg_duration_ms / 1000); // секунды
        
        console.log(`${day.day_name.padStart(11)} | ${day.trades_count.toString().padStart(6)} | ${pnlEmoji} ${pnlFormatted.padStart(8)} | ${winRate.toFixed(1).padStart(6)}% | ${day.avg_pnl.toFixed(4).padStart(10)} | ${avgDuration}s`);
      });

      // Находим лучший и худший день
      const bestDay = dayStats.reduce((best, day) => day.total_pnl > best.total_pnl ? day : best);
      const worstDay = dayStats.reduce((worst, day) => day.total_pnl < worst.total_pnl ? day : worst);

      console.log('\n🎯 Лучшие и худшие дни недели:');
      console.log(`   Лучший день: ${bestDay.day_name} (+${bestDay.total_pnl.toFixed(4)} USDC, ${bestDay.trades_count} сделок)`);
      console.log(`   Худший день: ${worstDay.day_name} (${worstDay.total_pnl.toFixed(4)} USDC, ${worstDay.trades_count} сделок)`);

    } catch (error) {
      console.error('❌ Ошибка анализа по дням недели:', error.message);
    }
  }

  // Анализ активности по месяцам
  async analyzeMonthly() {
    console.log('\n📆 АНАЛИЗ АКТИВНОСТИ ПО МЕСЯЦАМ:');
    console.log('═'.repeat(60));

    try {
      const monthlyStats = await this.query(`
        SELECT 
          strftime('%Y-%m', datetime(ts_entry/1000, 'unixepoch')) as month,
          COUNT(*) as trades_count,
          SUM(pnl) as total_pnl,
          AVG(pnl) as avg_pnl,
          COUNT(CASE WHEN pnl > 0 THEN 1 END) as winning_trades,
          COUNT(CASE WHEN pnl < 0 THEN 1 END) as losing_trades,
          MAX(pnl) as best_trade,
          MIN(pnl) as worst_trade,
          SUM(qty) as total_volume
        FROM trades 
        GROUP BY month 
        ORDER BY month DESC
      `);

      if (monthlyStats.length === 0) {
        console.log('   ℹ️ Нет данных для анализа по месяцам');
        return;
      }

      console.log('Месяц    | Сделок | PnL      | Винрейт | Лучшая  | Худшая  | Объем');
      console.log('─'.repeat(70));

      monthlyStats.forEach(month => {
        const winRate = month.trades_count > 0 ? (month.winning_trades / month.trades_count * 100) : 0;
        const pnlEmoji = month.total_pnl >= 0 ? '🟢' : '🔴';
        const pnlFormatted = month.total_pnl >= 0 ? `+${month.total_pnl.toFixed(4)}` : month.total_pnl.toFixed(4);
        
        console.log(`${month.month.padStart(8)} | ${month.trades_count.toString().padStart(6)} | ${pnlEmoji} ${pnlFormatted.padStart(8)} | ${winRate.toFixed(1).padStart(6)}% | ${month.best_trade.toFixed(4).padStart(7)} | ${month.worst_trade.toFixed(4).padStart(7)} | ${month.total_volume.toFixed(4)}`);
      });

      // Тренд по месяцам
      console.log('\n📈 Тренд по месяцам:');
      for (let i = 1; i < monthlyStats.length; i++) {
        const current = monthlyStats[i - 1];
        const previous = monthlyStats[i];
        const pnlChange = current.total_pnl - previous.total_pnl;
        const tradesChange = current.trades_count - previous.trades_count;
        
        const pnlTrend = pnlChange > 0 ? '📈' : pnlChange < 0 ? '📉' : '➡️';
        const tradesTrend = tradesChange > 0 ? '📈' : tradesChange < 0 ? '📉' : '➡️';
        
        console.log(`   ${current.month}: PnL ${pnlTrend} ${pnlChange >= 0 ? '+' : ''}${pnlChange.toFixed(4)}, Сделок ${tradesTrend} ${tradesChange >= 0 ? '+' : ''}${tradesChange}`);
      }

    } catch (error) {
      console.error('❌ Ошибка анализа по месяцам:', error.message);
    }
  }

  // Анализ сезонности
  async analyzeSeasonality() {
    console.log('\n🌍 АНАЛИЗ СЕЗОННОСТИ:');
    console.log('═'.repeat(50));

    try {
      const seasonStats = await this.query(`
        SELECT 
          CASE 
            WHEN strftime('%m', datetime(ts_entry/1000, 'unixepoch')) IN ('12', '01', '02') THEN 'Зима'
            WHEN strftime('%m', datetime(ts_entry/1000, 'unixepoch')) IN ('03', '04', '05') THEN 'Весна'
            WHEN strftime('%m', datetime(ts_entry/1000, 'unixepoch')) IN ('06', '07', '08') THEN 'Лето'
            WHEN strftime('%m', datetime(ts_entry/1000, 'unixepoch')) IN ('09', '10', '11') THEN 'Осень'
          END as season,
          COUNT(*) as trades_count,
          SUM(pnl) as total_pnl,
          AVG(pnl) as avg_pnl,
          COUNT(CASE WHEN pnl > 0 THEN 1 END) as winning_trades
        FROM trades 
        WHERE season IS NOT NULL
        GROUP BY season
        ORDER BY 
          CASE season
            WHEN 'Зима' THEN 1
            WHEN 'Весна' THEN 2
            WHEN 'Лето' THEN 3
            WHEN 'Осень' THEN 4
          END
      `);

      if (seasonStats.length === 0) {
        console.log('   ℹ️ Недостаточно данных для анализа сезонности');
        return;
      }

      console.log('Сезон  | Сделок | PnL      | Винрейт | Средний PnL');
      console.log('─'.repeat(50));

      seasonStats.forEach(season => {
        const winRate = season.trades_count > 0 ? (season.winning_trades / season.trades_count * 100) : 0;
        const pnlEmoji = season.total_pnl >= 0 ? '🟢' : '🔴';
        const pnlFormatted = season.total_pnl >= 0 ? `+${season.total_pnl.toFixed(4)}` : season.total_pnl.toFixed(4);
        
        console.log(`${season.season.padStart(6)} | ${season.trades_count.toString().padStart(6)} | ${pnlEmoji} ${pnlFormatted.padStart(8)} | ${winRate.toFixed(1).padStart(6)}% | ${season.avg_pnl.toFixed(4).padStart(10)}`);
      });

      // Лучший сезон
      const bestSeason = seasonStats.reduce((best, season) => season.total_pnl > best.total_pnl ? season : best);
      console.log(`\n🏆 Лучший сезон: ${bestSeason.season} (+${bestSeason.total_pnl.toFixed(4)} USDC)`);

    } catch (error) {
      console.error('❌ Ошибка анализа сезонности:', error.message);
    }
  }

  // Анализ активности по времени суток
  async analyzeTimeOfDay() {
    console.log('\n🕐 АНАЛИЗ АКТИВНОСТИ ПО ВРЕМЕНИ СУТОК:');
    console.log('═'.repeat(60));

    try {
      const timeStats = await this.query(`
        SELECT 
          CASE 
            WHEN strftime('%H', datetime(ts_entry/1000, 'unixepoch')) BETWEEN '00' AND '05' THEN 'Ночь (00-05)'
            WHEN strftime('%H', datetime(ts_entry/1000, 'unixepoch')) BETWEEN '06' AND '11' THEN 'Утро (06-11)'
            WHEN strftime('%H', datetime(ts_entry/1000, 'unixepoch')) BETWEEN '12' AND '17' THEN 'День (12-17)'
            WHEN strftime('%H', datetime(ts_entry/1000, 'unixepoch')) BETWEEN '18' AND '23' THEN 'Вечер (18-23)'
          END as time_period,
          COUNT(*) as trades_count,
          SUM(pnl) as total_pnl,
          AVG(pnl) as avg_pnl,
          COUNT(CASE WHEN pnl > 0 THEN 1 END) as winning_trades
        FROM trades 
        WHERE time_period IS NOT NULL
        GROUP BY time_period
        ORDER BY 
          CASE time_period
            WHEN 'Ночь (00-05)' THEN 1
            WHEN 'Утро (06-11)' THEN 2
            WHEN 'День (12-17)' THEN 3
            WHEN 'Вечер (18-23)' THEN 4
          END
      `);

      if (timeStats.length === 0) {
        console.log('   ℹ️ Нет данных для анализа по времени суток');
        return;
      }

      console.log('Период      | Сделок | PnL      | Винрейт | Средний PnL');
      console.log('─'.repeat(60));

      timeStats.forEach(period => {
        const winRate = period.trades_count > 0 ? (period.winning_trades / period.trades_count * 100) : 0;
        const pnlEmoji = period.total_pnl >= 0 ? '🟢' : '🔴';
        const pnlFormatted = period.total_pnl >= 0 ? `+${period.total_pnl.toFixed(4)}` : period.total_pnl.toFixed(4);
        
        console.log(`${period.time_period.padStart(11)} | ${period.trades_count.toString().padStart(6)} | ${pnlEmoji} ${pnlFormatted.padStart(8)} | ${winRate.toFixed(1).padStart(6)}% | ${period.avg_pnl.toFixed(4).padStart(10)}`);
      });

      // Лучший период
      const bestPeriod = timeStats.reduce((best, period) => period.total_pnl > best.total_pnl ? period : best);
      console.log(`\n🏆 Лучший период: ${bestPeriod.time_period} (+${bestPeriod.total_pnl.toFixed(4)} USDC)`);

    } catch (error) {
      console.error('❌ Ошибка анализа по времени суток:', error.message);
    }
  }

  // Анализ длительности сделок
  async analyzeTradeDuration() {
    console.log('\n⏱️ АНАЛИЗ ДЛИТЕЛЬНОСТИ СДЕЛОК:');
    console.log('═'.repeat(50));

    try {
      const durationStats = await this.query(`
        SELECT 
          CASE 
            WHEN duration_ms < 60000 THEN 'Менее 1 мин'
            WHEN duration_ms < 300000 THEN '1-5 мин'
            WHEN duration_ms < 900000 THEN '5-15 мин'
            WHEN duration_ms < 3600000 THEN '15-60 мин'
            WHEN duration_ms < 86400000 THEN '1-24 часа'
            ELSE 'Более 24 часов'
          END as duration_range,
          COUNT(*) as trades_count,
          SUM(pnl) as total_pnl,
          AVG(pnl) as avg_pnl,
          COUNT(CASE WHEN pnl > 0 THEN 1 END) as winning_trades,
          AVG(duration_ms) as avg_duration_ms
        FROM trades 
        GROUP BY duration_range
        ORDER BY 
          CASE duration_range
            WHEN 'Менее 1 мин' THEN 1
            WHEN '1-5 мин' THEN 2
            WHEN '5-15 мин' THEN 3
            WHEN '15-60 мин' THEN 4
            WHEN '1-24 часа' THEN 5
            WHEN 'Более 24 часов' THEN 6
          END
      `);

      if (durationStats.length === 0) {
        console.log('   ℹ️ Нет данных для анализа длительности');
        return;
      }

      console.log('Длительность | Сделок | PnL      | Винрейт | Средний PnL | Среднее время');
      console.log('─'.repeat(70));

      durationStats.forEach(duration => {
        const winRate = duration.trades_count > 0 ? (duration.winning_trades / duration.trades_count * 100) : 0;
        const pnlEmoji = duration.total_pnl >= 0 ? '🟢' : '🔴';
        const pnlFormatted = duration.total_pnl >= 0 ? `+${duration.total_pnl.toFixed(4)}` : duration.total_pnl.toFixed(4);
        const avgDurationMinutes = Math.round(duration.avg_duration_ms / 60000);
        
        console.log(`${duration.duration_range.padStart(12)} | ${duration.trades_count.toString().padStart(6)} | ${pnlEmoji} ${pnlFormatted.padStart(8)} | ${winRate.toFixed(1).padStart(6)}% | ${duration.avg_pnl.toFixed(4).padStart(10)} | ${avgDurationMinutes} мин`);
      });

      // Оптимальная длительность
      const bestDuration = durationStats.reduce((best, duration) => duration.avg_pnl > best.avg_pnl ? duration : best);
      console.log(`\n🎯 Оптимальная длительность: ${bestDuration.duration_range} (средний PnL: ${bestDuration.avg_pnl.toFixed(4)} USDC)`);

    } catch (error) {
      console.error('❌ Ошибка анализа длительности:', error.message);
    }
  }

  // Анализ трендов
  async analyzeTrends() {
    console.log('\n📈 АНАЛИЗ ТРЕНДОВ:');
    console.log('═'.repeat(50));

    try {
      // Тренд по неделям
      const weeklyTrends = await this.query(`
        SELECT 
          strftime('%Y-W%W', datetime(ts_entry/1000, 'unixepoch')) as week,
          COUNT(*) as trades_count,
          SUM(pnl) as total_pnl,
          AVG(pnl) as avg_pnl
        FROM trades 
        WHERE ts_entry > strftime('%s', 'now', '-12 weeks') * 1000
        GROUP BY week 
        ORDER BY week DESC
        LIMIT 12
      `);

      if (weeklyTrends.length > 1) {
        console.log('📊 Тренд по неделям (последние 12 недель):');
        console.log('Неделя    | Сделок | PnL      | Средний PnL');
        console.log('─'.repeat(50));

        weeklyTrends.forEach(week => {
          const pnlEmoji = week.total_pnl >= 0 ? '🟢' : '🔴';
          const pnlFormatted = week.total_pnl >= 0 ? `+${week.total_pnl.toFixed(4)}` : week.total_pnl.toFixed(4);
          
          console.log(`${week.week.padStart(9)} | ${week.trades_count.toString().padStart(6)} | ${pnlEmoji} ${pnlFormatted.padStart(8)} | ${week.avg_pnl.toFixed(4).padStart(10)}`);
        });

        // Анализ тренда
        const recentWeeks = weeklyTrends.slice(0, 4);
        const olderWeeks = weeklyTrends.slice(4, 8);
        
        const recentAvgPnL = recentWeeks.reduce((sum, w) => sum + w.avg_pnl, 0) / recentWeeks.length;
        const olderAvgPnL = olderWeeks.reduce((sum, w) => sum + w.avg_pnl, 0) / olderWeeks.length;
        
        const trend = recentAvgPnL - olderAvgPnL;
        const trendEmoji = trend > 0 ? '📈' : trend < 0 ? '📉' : '➡️';
        
        console.log(`\n🎯 Тренд: ${trendEmoji} ${trend >= 0 ? '+' : ''}${trend.toFixed(4)} USDC (последние 4 недели vs предыдущие 4)`);
      }

    } catch (error) {
      console.error('❌ Ошибка анализа трендов:', error.message);
    }
  }

  async run() {
    try {
      await this.connectDB();
      await this.analyzeDayOfWeek();
      await this.analyzeMonthly();
      await this.analyzeSeasonality();
      await this.analyzeTimeOfDay();
      await this.analyzeTradeDuration();
      await this.analyzeTrends();
    } catch (error) {
      console.error('❌ Критическая ошибка:', error.message);
    } finally {
      await this.closeDB();
    }
  }
}

// Запуск анализа
const analyzer = new TimeAnalysisAnalyzer();
analyzer.run();


