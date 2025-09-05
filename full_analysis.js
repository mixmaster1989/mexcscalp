#!/usr/bin/env node
require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 ПОЛНЫЙ АНАЛИЗ СТАТИСТИКИ ОРДЕРОВ MEXC SCALPER');
console.log('═'.repeat(80));
console.log('');

class FullAnalysisRunner {
  constructor() {
    this.scripts = [
      { name: '📊 Статистика ордеров', file: 'order_stats.js' },
      { name: '📋 Анализ событий', file: 'events_analysis.js' },
      { name: '💰 Анализ PnL', file: 'pnl_analysis.js' },
      { name: '⏰ Временной анализ', file: 'time_analysis.js' }
    ];
  }

  async runScript(scriptPath) {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [scriptPath], {
        stdio: 'inherit',
        cwd: __dirname
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Скрипт завершился с кодом ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  async run() {
    console.log('🎯 Запуск комплексного анализа...\n');

    for (let i = 0; i < this.scripts.length; i++) {
      const script = this.scripts[i];
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📋 ${i + 1}/${this.scripts.length} - ${script.name}`);
      console.log(`${'='.repeat(80)}\n`);

      try {
        await this.runScript(script.file);
        console.log(`\n✅ ${script.name} завершен успешно`);
      } catch (error) {
        console.error(`\n❌ Ошибка в ${script.name}:`, error.message);
      }

      // Пауза между скриптами
      if (i < this.scripts.length - 1) {
        console.log('\n⏳ Переход к следующему анализу...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎉 ПОЛНЫЙ АНАЛИЗ ЗАВЕРШЕН!');
    console.log('='.repeat(80));
    console.log('\n💡 Для запуска отдельных анализов используйте:');
    console.log('   node order_stats.js     - Статистика ордеров');
    console.log('   node events_analysis.js - Анализ событий');
    console.log('   node pnl_analysis.js    - Анализ PnL');
    console.log('   node time_analysis.js   - Временной анализ');
    console.log('\n📊 Все данные сохранены в базе данных: ./data/mexc_bot.db');
  }
}

// Запуск полного анализа
const runner = new FullAnalysisRunner();
runner.run().catch(error => {
  console.error('❌ Критическая ошибка:', error.message);
  process.exit(1);
});
