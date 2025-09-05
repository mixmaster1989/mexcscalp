#!/usr/bin/env node
require('dotenv').config();
const { MexcRestClient } = require('./dist/infra/mexcRest');

console.log('🔍 АНАЛИЗ СДЕЛОК СЕГОДНЯ: с 8:00 утра по сейчас\n');

const client = new MexcRestClient(process.env.MEXC_API_KEY, process.env.MEXC_SECRET_KEY);

// Функция для расчета PnL пар сделок BUY/SELL
function calculateTradePairsPnL(trades) {
    const buyTrades = trades.filter(t => t.side === 'buy').sort((a, b) => a.timestamp - b.timestamp);
    const sellTrades = trades.filter(t => t.side === 'sell').sort((a, b) => a.timestamp - b.timestamp);
    const tradesWithPnL = [...trades];
    
    // Сопоставляем BUY и SELL сделки для расчета PnL
    let buyIndex = 0;
    let sellIndex = 0;
    
    while (buyIndex < buyTrades.length && sellIndex < sellTrades.length) {
        const buyTrade = buyTrades[buyIndex];
        const sellTrade = sellTrades[sellIndex];
        
        // Ищем соответствующие сделки в основном массиве
        const buyTradeInMain = tradesWithPnL.find(t => t.id === buyTrade.id);
        const sellTradeInMain = tradesWithPnL.find(t => t.id === sellTrade.id);
        
        if (buyTradeInMain && sellTradeInMain) {
            // Рассчитываем PnL: (Цена продажи - Цена покупки) * Количество
            const pnl = (sellTrade.price - buyTrade.price) * buyTrade.quantity;
            
            // Обновляем PnL в обеих сделках
            buyTradeInMain.pnl = pnl;
            sellTradeInMain.pnl = pnl;
        }
        
        buyIndex++;
        sellIndex++;
    }
    
    return tradesWithPnL;
}

// Функция для расчета статистики
function calculateTradeStats(trades) {
    if (trades.length === 0) {
        return {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalPnl: 0,
            avgPnl: 0,
            winRate: 0,
            bestTrade: 0,
            worstTrade: 0
        };
    }
    
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const bestTrade = Math.max(...trades.map(t => t.pnl || 0));
    const worstTrade = Math.min(...trades.map(t => t.pnl || 0));
    
    return {
        totalTrades: trades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        totalPnl,
        avgPnl: totalPnl / trades.length,
        winRate: (winningTrades.length / trades.length) * 100,
        bestTrade,
        worstTrade
    };
}

async function analyzeToday() {
  try {
    // Определяем временные границы - с 8:00 утра сегодня
    const today = new Date();
    const startTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 0, 0).getTime();
    const endTime = Date.now();
    
    console.log('⏰ Период анализа:');
    console.log(`   Начало: ${new Date(startTime).toLocaleString('ru-RU')}`);
    console.log(`   Конец: ${new Date(endTime).toLocaleString('ru-RU')}`);
    console.log(`   Длительность: ${Math.round((endTime - startTime) / (1000 * 60 * 60 * 100)) / 10} часов\n`);

    // Получаем все сделки
    console.log('📊 Получение всех сделок...');
    const allTrades = await client.getMyTrades('ETHUSDC', 1000);
    
    // Фильтруем сделки по периоду
    const periodTrades = allTrades.filter(trade => 
      trade.timestamp >= startTime && trade.timestamp <= endTime
    );
    
    console.log(`✅ Найдено ${periodTrades.length} сделок за указанный период\n`);
    
    if (periodTrades.length === 0) {
      console.log('ℹ️  За указанный период сделок не найдено');
      return;
    }

    // Рассчитываем PnL для сделок
    console.log('💰 Расчет PnL для сделок...');
    const tradesWithPnL = calculateTradePairsPnL(periodTrades);
    
    // Рассчитываем статистику
    const stats = calculateTradeStats(tradesWithPnL);
    
    // Группируем сделки по часам
    const tradesByHour = {};
    tradesWithPnL.forEach(trade => {
      const hour = new Date(trade.timestamp).getHours();
      const hourKey = `${hour.toString().padStart(2, '0')}:00`;
      if (!tradesByHour[hourKey]) {
        tradesByHour[hourKey] = [];
      }
      tradesByHour[hourKey].push(trade);
    });

    // Анализируем каждый час
    console.log('⏰ АНАЛИЗ ПО ЧАСАМ:');
    console.log('═'.repeat(80));
    
    let totalPnL = 0;
    let totalTrades = 0;
    let winningTrades = 0;
    let losingTrades = 0;

    Object.keys(tradesByHour).sort().forEach(hour => {
      const hourTrades = tradesByHour[hour];
      const buyTrades = hourTrades.filter(t => t.side === 'buy');
      const sellTrades = hourTrades.filter(t => t.side === 'sell');
      
      // Рассчитываем PnL за час
      const hourPnL = hourTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const hourWinning = hourTrades.filter(t => (t.pnl || 0) > 0).length;
      const hourLosing = hourTrades.filter(t => (t.pnl || 0) < 0).length;
      
      console.log(`\n⏰ ${hour}:`);
      console.log(`   Сделок: ${hourTrades.length} (BUY: ${buyTrades.length}, SELL: ${sellTrades.length})`);
      console.log(`   PnL за час: ${hourPnL >= 0 ? '🟢' : '🔴'} ${hourPnL.toFixed(4)} USDC`);
      console.log(`   Прибыльных: ${hourWinning}, Убыточных: ${hourLosing}`);
      
      totalPnL += hourPnL;
      totalTrades += hourTrades.length;
      winningTrades += hourWinning;
      losingTrades += hourLosing;
    });

    // Анализируем общую статистику
    console.log('\n📊 ОБЩАЯ СТАТИСТИКА ЗА ПЕРИОД:');
    console.log('═'.repeat(50));
    console.log(`Всего сделок: ${totalTrades}`);
    console.log(`BUY сделок: ${periodTrades.filter(t => t.side === 'buy').length}`);
    console.log(`SELL сделок: ${periodTrades.filter(t => t.side === 'sell').length}`);
    
    // PnL статистика
    console.log(`\n💰 PnL СТАТИСТИКА:`);
    console.log(`   Общий PnL: ${totalPnL >= 0 ? '🟢' : '🔴'} ${totalPnL.toFixed(4)} USDC`);
    console.log(`   Прибыльных сделок: ${winningTrades}`);
    console.log(`   Убыточных сделок: ${losingTrades}`);
    console.log(`   Винрейт: ${stats.winRate.toFixed(2)}%`);
    console.log(`   Средний PnL: ${stats.avgPnl.toFixed(4)} USDC`);
    console.log(`   Лучшая сделка: 🟢 +${stats.bestTrade.toFixed(4)} USDC`);
    console.log(`   Худшая сделка: 🔴 ${stats.worstTrade.toFixed(4)} USDC`);
    
    // Анализируем цены
    const prices = periodTrades.map(t => t.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    
    console.log(`\n💰 АНАЛИЗ ЦЕН:`);
    console.log(`   Минимальная: ${minPrice.toFixed(2)} USDC`);
    console.log(`   Максимальная: ${maxPrice.toFixed(2)} USDC`);
    console.log(`   Средняя: ${avgPrice.toFixed(2)} USDC`);
    console.log(`   Волатильность: ${(maxPrice - minPrice).toFixed(2)} USDC`);
    
    // Анализируем объемы
    const volumes = periodTrades.map(t => t.quantity);
    const totalVolume = volumes.reduce((sum, v) => sum + v, 0);
    const avgVolume = totalVolume / volumes.length;
    
    console.log(`\n📏 АНАЛИЗ ОБЪЕМОВ:`);
    console.log(`   Общий объем: ${totalVolume.toFixed(6)} ETH`);
    console.log(`   Средний объем: ${avgVolume.toFixed(6)} ETH`);
    
    // Выводы
    console.log('\n🎯 ВЫВОДЫ:');
    console.log('═'.repeat(50));
    
    if (totalTrades > 0) {
      const buyRatio = (periodTrades.filter(t => t.side === 'buy').length / totalTrades * 100).toFixed(1);
      const sellRatio = (periodTrades.filter(t => t.side === 'sell').length / totalTrades * 100).toFixed(1);
      
      console.log(`✅ Активность: ${totalTrades} сделок за период`);
      console.log(`✅ Распределение: BUY ${buyRatio}%, SELL ${sellRatio}%`);
      console.log(`✅ Ценовой диапазон: ${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)} USDC`);
      console.log(`✅ Общий объем: ${totalVolume.toFixed(6)} ETH`);
      console.log(`✅ Общий PnL: ${totalPnL >= 0 ? '🟢' : '🔴'} ${totalPnL.toFixed(4)} USDC`);
      console.log(`✅ Винрейт: ${stats.winRate.toFixed(2)}%`);
      
      if (maxPrice - minPrice > 50) {
        console.log(`⚠️  Высокая волатильность: ${(maxPrice - minPrice).toFixed(2)} USDC`);
      }
      
      if (totalTrades > 50) {
        console.log(`⚠️  Высокая активность: ${totalTrades} сделок за период`);
      }
      
      if (totalPnL > 0) {
        console.log(`🎉 Прибыльный период: +${totalPnL.toFixed(4)} USDC`);
      } else if (totalPnL < 0) {
        console.log(`📉 Убыточный период: ${totalPnL.toFixed(4)} USDC`);
      } else {
        console.log(`➖ Нейтральный период: 0.0000 USDC`);
      }
    }
    
  } catch (error) {
    console.error('❌ ОШИБКА АНАЛИЗА:', error.message);
  }
}

analyzeToday();

