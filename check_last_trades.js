#!/usr/bin/env node
require('dotenv').config();
const { MexcRestClient } = require('./dist/infra/mexcRest');

console.log('🔍 ПРОВЕРКА ПОСЛЕДНИХ СДЕЛОК\n');

const client = new MexcRestClient(process.env.MEXC_API_KEY, process.env.MEXC_SECRET_KEY);

async function checkLastTrades() {
  try {
    console.log('📊 Получение последних сделок через API...\n');
    
    // Получаем последние сделки
    const trades = await client.getMyTrades('ETHUSDC', 50);
    
    if (trades.length === 0) {
      console.log('❌ Сделок не найдено');
      return;
    }
    
    console.log(`✅ Найдено ${trades.length} сделок\n`);
    
    // Показываем последние 10 сделок
    console.log('📋 ПОСЛЕДНИЕ СДЕЛКИ:');
    console.log('═'.repeat(80));
    console.log('Время                | Сторона | Цена     | Количество | ID');
    console.log('─'.repeat(80));
    
    trades.slice(0, 10).forEach((trade, i) => {
      const time = new Date(trade.timestamp).toLocaleString('ru-RU');
      const side = trade.side === 'buy' ? '🟢 BUY' : '🔴 SELL';
      const price = parseFloat(trade.price).toFixed(2);
      const quantity = parseFloat(trade.quantity).toFixed(6);
      
      console.log(`${time.padStart(19)} | ${side.padStart(7)} | ${price.padStart(8)} | ${quantity.padStart(10)} | ${trade.id}`);
    });
    
    // Анализируем последнюю сделку
    const lastTrade = trades[0];
    const lastTradeTime = new Date(lastTrade.timestamp);
    const now = new Date();
    const timeDiff = now - lastTradeTime;
    const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutesAgo = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    console.log('\n🎯 АНАЛИЗ ПОСЛЕДНЕЙ СДЕЛКИ:');
    console.log('═'.repeat(50));
    console.log(`Время: ${lastTradeTime.toLocaleString('ru-RU')}`);
    console.log(`Сторона: ${lastTrade.side === 'buy' ? '🟢 BUY' : '🔴 SELL'}`);
    console.log(`Цена: ${lastTrade.price} USDC`);
    console.log(`Количество: ${lastTrade.quantity} ETH`);
    console.log(`ID: ${lastTrade.id}`);
    console.log(`Комиссия: ${lastTrade.commission || 'N/A'}`);
    console.log(`Время назад: ${hoursAgo}ч ${minutesAgo}м`);
    
    // Группируем по дням
    const tradesByDay = {};
    trades.forEach(trade => {
      const date = new Date(trade.timestamp).toLocaleDateString('ru-RU');
      if (!tradesByDay[date]) {
        tradesByDay[date] = [];
      }
      tradesByDay[date].push(trade);
    });
    
    console.log('\n📅 СДЕЛКИ ПО ДНЯМ:');
    console.log('═'.repeat(50));
    Object.keys(tradesByDay).sort().reverse().forEach(date => {
      const dayTrades = tradesByDay[date];
      const buyTrades = dayTrades.filter(t => t.side === 'buy').length;
      const sellTrades = dayTrades.filter(t => t.side === 'sell').length;
      console.log(`${date}: ${dayTrades.length} сделок (BUY: ${buyTrades}, SELL: ${sellTrades})`);
    });
    
    // Проверяем, есть ли сделки за последние 24 часа
    const last24h = trades.filter(trade => {
      const tradeTime = new Date(trade.timestamp);
      const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
      return tradeTime > dayAgo;
    });
    
    console.log('\n⏰ АКТИВНОСТЬ ЗА ПОСЛЕДНИЕ 24 ЧАСА:');
    console.log('═'.repeat(50));
    if (last24h.length > 0) {
      console.log(`✅ ${last24h.length} сделок за последние 24 часа`);
      const last24hTime = new Date(last24h[0].timestamp);
      console.log(`Последняя: ${last24hTime.toLocaleString('ru-RU')}`);
    } else {
      console.log('❌ Нет сделок за последние 24 часа');
    }
    
    // Проверяем, есть ли сделки за последнюю неделю
    const lastWeek = trades.filter(trade => {
      const tradeTime = new Date(trade.timestamp);
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      return tradeTime > weekAgo;
    });
    
    console.log(`\n📊 АКТИВНОСТЬ ЗА ПОСЛЕДНЮЮ НЕДЕЛЮ: ${lastWeek.length} сделок`);
    
  } catch (error) {
    console.error('❌ Ошибка получения сделок:', error.message);
  }
}

checkLastTrades();
