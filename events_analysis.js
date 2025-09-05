#!/usr/bin/env node
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();

console.log('📋 АНАЛИЗ СОБЫТИЙ СИСТЕМЫ\n');

class EventsAnalyzer {
  constructor() {
    this.db = null;
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

  // Анализ типов событий
  async analyzeEventTypes() {
    console.log('📊 АНАЛИЗ ТИПОВ СОБЫТИЙ:');
    console.log('═'.repeat(50));

    try {
      const eventTypes = await this.query(`
        SELECT 
          type, 
          COUNT(*) as count,
          MIN(ts) as first_event,
          MAX(ts) as last_event
        FROM events 
        GROUP BY type 
        ORDER BY count DESC
      `);

      if (eventTypes.length === 0) {
        console.log('   ℹ️ Нет событий в базе данных');
        return;
      }

      console.log('Тип события | Количество | Первое | Последнее');
      console.log('─'.repeat(60));

      eventTypes.forEach(event => {
        const firstDate = new Date(event.first_event).toLocaleString('ru-RU');
        const lastDate = new Date(event.last_event).toLocaleString('ru-RU');
        console.log(`${event.type.padStart(11)} | ${event.count.toString().padStart(10)} | ${firstDate} | ${lastDate}`);
      });

      const totalEvents = eventTypes.reduce((sum, event) => sum + event.count, 0);
      console.log(`\n📈 Всего событий: ${totalEvents}`);

    } catch (error) {
      console.error('❌ Ошибка анализа типов событий:', error.message);
    }
  }

  // Анализ событий по времени
  async analyzeEventsByTime() {
    console.log('\n⏰ АНАЛИЗ СОБЫТИЙ ПО ВРЕМЕНИ:');
    console.log('═'.repeat(50));

    try {
      // По дням
      const dailyEvents = await this.query(`
        SELECT 
          DATE(datetime(ts/1000, 'unixepoch')) as date,
          COUNT(*) as events_count,
          COUNT(DISTINCT type) as unique_types
        FROM events 
        GROUP BY date 
        ORDER BY date DESC
        LIMIT 10
      `);

      if (dailyEvents.length > 0) {
        console.log('📅 События по дням (последние 10 дней):');
        console.log('Дата       | Событий | Типов');
        console.log('─'.repeat(30));

        dailyEvents.forEach(day => {
          console.log(`${day.date} | ${day.events_count.toString().padStart(7)} | ${day.unique_types.toString().padStart(5)}`);
        });
      }

      // По часам
      const hourlyEvents = await this.query(`
        SELECT 
          strftime('%H', datetime(ts/1000, 'unixepoch')) as hour,
          COUNT(*) as events_count
        FROM events 
        WHERE ts > strftime('%s', 'now', '-7 days') * 1000
        GROUP BY hour 
        ORDER BY hour
      `);

      if (hourlyEvents.length > 0) {
        console.log('\n🕐 События по часам (последние 7 дней):');
        console.log('Час | Событий');
        console.log('─'.repeat(15));

        hourlyEvents.forEach(hour => {
          const bar = '█'.repeat(Math.min(Math.floor(hour.events_count / 10), 20));
          console.log(`${hour.hour.padStart(3)} | ${hour.events_count.toString().padStart(7)} ${bar}`);
        });
      }

    } catch (error) {
      console.error('❌ Ошибка анализа событий по времени:', error.message);
    }
  }

  // Анализ последних событий
  async analyzeRecentEvents() {
    console.log('\n📋 ПОСЛЕДНИЕ СОБЫТИЯ:');
    console.log('═'.repeat(50));

    try {
      const recentEvents = await this.query(`
        SELECT 
          type,
          payload_json,
          datetime(ts/1000, 'unixepoch') as event_time,
          ts
        FROM events 
        ORDER BY ts DESC 
        LIMIT 20
      `);

      if (recentEvents.length === 0) {
        console.log('   ℹ️ Нет событий в базе данных');
        return;
      }

      console.log('Время                | Тип события | Детали');
      console.log('─'.repeat(80));

      recentEvents.forEach(event => {
        const time = new Date(event.ts).toLocaleString('ru-RU');
        let details = '';
        
        try {
          const payload = JSON.parse(event.payload_json);
          if (payload.symbol) details += `Symbol: ${payload.symbol} `;
          if (payload.price) details += `Price: ${payload.price} `;
          if (payload.quantity) details += `Qty: ${payload.quantity} `;
          if (payload.side) details += `Side: ${payload.side} `;
          if (payload.status) details += `Status: ${payload.status} `;
          if (payload.message) details += `Msg: ${payload.message} `;
        } catch (e) {
          details = event.payload_json.substring(0, 50) + '...';
        }

        console.log(`${time.padStart(19)} | ${event.type.padStart(11)} | ${details}`);
      });

    } catch (error) {
      console.error('❌ Ошибка анализа последних событий:', error.message);
    }
  }

  // Анализ ошибок
  async analyzeErrors() {
    console.log('\n❌ АНАЛИЗ ОШИБОК:');
    console.log('═'.repeat(50));

    try {
      const errorEvents = await this.query(`
        SELECT 
          type,
          payload_json,
          datetime(ts/1000, 'unixepoch') as event_time,
          ts
        FROM events 
        WHERE type LIKE '%error%' OR type LIKE '%Error%' OR type LIKE '%ERROR%'
        ORDER BY ts DESC 
        LIMIT 10
      `);

      if (errorEvents.length === 0) {
        console.log('   ✅ Ошибок не найдено');
        return;
      }

      console.log('Время                | Тип ошибки | Детали');
      console.log('─'.repeat(80));

      errorEvents.forEach(event => {
        const time = new Date(event.ts).toLocaleString('ru-RU');
        let details = '';
        
        try {
          const payload = JSON.parse(event.payload_json);
          if (payload.error) details += `Error: ${payload.error} `;
          if (payload.message) details += `Message: ${payload.message} `;
          if (payload.code) details += `Code: ${payload.code} `;
        } catch (e) {
          details = event.payload_json.substring(0, 50) + '...';
        }

        console.log(`${time.padStart(19)} | ${event.type.padStart(10)} | ${details}`);
      });

      // Статистика ошибок по типам
      const errorStats = await this.query(`
        SELECT 
          type,
          COUNT(*) as count
        FROM events 
        WHERE type LIKE '%error%' OR type LIKE '%Error%' OR type LIKE '%ERROR%'
        GROUP BY type 
        ORDER BY count DESC
      `);

      if (errorStats.length > 0) {
        console.log('\n📊 Статистика ошибок по типам:');
        errorStats.forEach(stat => {
          console.log(`   ${stat.type}: ${stat.count} ошибок`);
        });
      }

    } catch (error) {
      console.error('❌ Ошибка анализа ошибок:', error.message);
    }
  }

  // Анализ активности системы
  async analyzeSystemActivity() {
    console.log('\n🔄 АНАЛИЗ АКТИВНОСТИ СИСТЕМЫ:');
    console.log('═'.repeat(50));

    try {
      // Общая статистика
      const totalStats = await this.getOne(`
        SELECT 
          COUNT(*) as total_events,
          MIN(ts) as first_event,
          MAX(ts) as last_event
        FROM events
      `);

      if (totalStats.total_events === 0) {
        console.log('   ℹ️ Нет событий в системе');
        return;
      }

      const firstEvent = new Date(totalStats.first_event).toLocaleString('ru-RU');
      const lastEvent = new Date(totalStats.last_event).toLocaleString('ru-RU');
      const duration = totalStats.last_event - totalStats.first_event;
      const durationHours = Math.round(duration / (1000 * 60 * 60));

      console.log('📊 Общая статистика:');
      console.log(`   Всего событий: ${totalStats.total_events}`);
      console.log(`   Первое событие: ${firstEvent}`);
      console.log(`   Последнее событие: ${lastEvent}`);
      console.log(`   Период работы: ${durationHours} часов`);

      // Активность за последние 24 часа
      const last24h = await this.getOne(`
        SELECT COUNT(*) as count
        FROM events 
        WHERE ts > strftime('%s', 'now', '-1 day') * 1000
      `);

      console.log(`   Событий за 24ч: ${last24h.count}`);

      // Активность за последний час
      const last1h = await this.getOne(`
        SELECT COUNT(*) as count
        FROM events 
        WHERE ts > strftime('%s', 'now', '-1 hour') * 1000
      `);

      console.log(`   Событий за 1ч: ${last1h.count}`);

      // Средняя активность
      const avgPerHour = durationHours > 0 ? (totalStats.total_events / durationHours).toFixed(2) : 0;
      console.log(`   Средняя активность: ${avgPerHour} событий/час`);

    } catch (error) {
      console.error('❌ Ошибка анализа активности системы:', error.message);
    }
  }

  async run() {
    try {
      await this.connectDB();
      await this.analyzeEventTypes();
      await this.analyzeEventsByTime();
      await this.analyzeRecentEvents();
      await this.analyzeErrors();
      await this.analyzeSystemActivity();
    } catch (error) {
      console.error('❌ Критическая ошибка:', error.message);
    } finally {
      await this.closeDB();
    }
  }
}

// Запуск анализа
const analyzer = new EventsAnalyzer();
analyzer.run();


