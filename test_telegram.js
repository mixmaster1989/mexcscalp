#!/usr/bin/env node
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

console.log('📱 ТЕСТ TELEGRAM УВЕДОМЛЕНИЙ\n');

class TelegramTester {
  constructor() {
    this.telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
  }

  async testConnection() {
    try {
      console.log('🔍 Проверка подключения к Telegram...');
      
      const botInfo = await this.telegramBot.getMe();
      console.log(`✅ Бот подключен: @${botInfo.username}`);
      console.log(`📝 Имя: ${botInfo.first_name}`);
      
      return true;
    } catch (error) {
      console.error('❌ Ошибка подключения к Telegram:', error.message);
      return false;
    }
  }

  async testMessage() {
    try {
      console.log('📤 Отправка тестового сообщения...');
      
      const message = 
        `🧪 *ТЕСТ TELEGRAM УВЕДОМЛЕНИЙ*\n\n` +
        `✅ Подключение работает\n` +
        `📱 Бот готов к работе\n` +
        `⏰ Время: ${new Date().toLocaleString('ru-RU')}\n\n` +
        `🚀 Скальпер готов к запуску!`;

      await this.telegramBot.sendMessage(
        process.env.TELEGRAM_ADMIN_CHAT_IDS,
        message,
        { parse_mode: 'Markdown' }
      );
      
      console.log('✅ Тестовое сообщение отправлено');
      return true;
      
    } catch (error) {
      console.error('❌ Ошибка отправки сообщения:', error.message);
      return false;
    }
  }

  async testTradeNotification() {
    try {
      console.log('💰 Тестирование уведомления о сделке...');
      
      const mockTrade = {
        side: 'buy',
        price: '4320.50',
        quantity: '0.0001',
        id: 'test_trade_123'
      };
      
      const side = mockTrade.side === 'buy' ? '🟢 ПОКУПКА' : '🔴 ПРОДАЖА';
      const notional = (parseFloat(mockTrade.price) * parseFloat(mockTrade.quantity)).toFixed(2);
      const time = new Date().toLocaleTimeString('ru-RU');
      
      const message = 
        `💰 *СДЕЛКА ИСПОЛНЕНА* (ТЕСТ)\n\n` +
        `${side}\n` +
        `💵 Цена: ${mockTrade.price} USDC\n` +
        `📊 Количество: ${mockTrade.quantity} ETH\n` +
        `💸 Сумма: ${notional} USDC\n` +
        `⏰ Время: ${time}\n\n` +
        `📈 *Статус:*\n` +
        `• Инвентарь: 0.000100 ETH\n` +
        `• В $: -0.43 USDC\n` +
        `• Режим: Ёршики\n\n` +
        `🎯 TP размещен автоматически`;

      await this.telegramBot.sendMessage(
        process.env.TELEGRAM_ADMIN_CHAT_IDS,
        message,
        { parse_mode: 'Markdown' }
      );
      
      console.log('✅ Уведомление о сделке отправлено');
      return true;
      
    } catch (error) {
      console.error('❌ Ошибка отправки уведомления о сделке:', error.message);
      return false;
    }
  }

  async testTPNotification() {
    try {
      console.log('🎯 Тестирование уведомления о TP...');
      
      const message = 
        `🎯 *TAKE PROFIT РАЗМЕЩЕН* (ТЕСТ)\n\n` +
        `📊 SELL: 4324.32 USDC\n` +
        `📈 Ожидаемая прибыль: 0.0004 USDC\n` +
        `📊 TP: 0.10%\n` +
        `⏰ Время: ${new Date().toLocaleTimeString('ru-RU')}`;

      await this.telegramBot.sendMessage(
        process.env.TELEGRAM_ADMIN_CHAT_IDS,
        message,
        { parse_mode: 'Markdown' }
      );
      
      console.log('✅ Уведомление о TP отправлено');
      return true;
      
    } catch (error) {
      console.error('❌ Ошибка отправки уведомления о TP:', error.message);
      return false;
    }
  }

  async testStatusNotification() {
    try {
      console.log('📊 Тестирование статусного уведомления...');
      
      const message = 
        `📊 *ПЕРИОДИЧЕСКИЙ СТАТУС* (ТЕСТ)\n\n` +
        `🎯 Режим: Ёршики\n` +
        `💰 Цена: 4320.50 USDC\n` +
        `📈 VWAP: 4318.75 USDC\n` +
        `📊 ATR: 0.4321 USDC\n\n` +
        `🟢 Buy ордеров: 5\n` +
        `🔴 Sell ордеров: 5\n` +
        `📊 Всего: 10\n\n` +
        `📈 *Позиция:*\n` +
        `• Инвентарь: 0.000100 ETH\n` +
        `• В $: -0.43 USDC\n` +
        `• PnL: 0.00 USDC\n\n` +
        `⏰ ${new Date().toLocaleTimeString('ru-RU')}`;

      await this.telegramBot.sendMessage(
        process.env.TELEGRAM_ADMIN_CHAT_IDS,
        message,
        { parse_mode: 'Markdown' }
      );
      
      console.log('✅ Статусное уведомление отправлено');
      return true;
      
    } catch (error) {
      console.error('❌ Ошибка отправки статусного уведомления:', error.message);
      return false;
    }
  }

  async runAllTests() {
    console.log('🚀 Запуск всех тестов Telegram...\n');
    
    const tests = [
      { name: 'Подключение', fn: () => this.testConnection() },
      { name: 'Тестовое сообщение', fn: () => this.testMessage() },
      { name: 'Уведомление о сделке', fn: () => this.testTradeNotification() },
      { name: 'Уведомление о TP', fn: () => this.testTPNotification() },
      { name: 'Статусное уведомление', fn: () => this.testStatusNotification() }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
      try {
        console.log(`\n🧪 Тест: ${test.name}`);
        const result = await test.fn();
        
        if (result) {
          console.log(`✅ ${test.name}: ПРОЙДЕН`);
          passed++;
        } else {
          console.log(`❌ ${test.name}: ПРОВАЛЕН`);
          failed++;
        }
        
        // Пауза между тестами
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`❌ ${test.name}: ОШИБКА - ${error.message}`);
        failed++;
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ:');
    console.log(`✅ Пройдено: ${passed}`);
    console.log(`❌ Провалено: ${failed}`);
    console.log(`📊 Всего: ${passed + failed}`);
    
    if (failed === 0) {
      console.log('\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Telegram готов к работе!');
    } else {
      console.log('\n⚠️ Есть проблемы с Telegram. Проверьте настройки.');
    }
  }
}

// Запуск тестов
async function main() {
  const tester = new TelegramTester();
  await tester.runAllTests();
}

main().catch(error => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});


