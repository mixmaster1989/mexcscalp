require('dotenv').config();
const { MexcSpotClient } = require('./dist/exchange/mexc-spot');

async function checkAllTrades() {
  console.log('🔍 ПОЛНЫЙ АНАЛИЗ ВСЕХ СДЕЛОК');
  console.log('============================\n');

  try {
    const client = new MexcSpotClient();
    
    // Получаем ВСЕ сделки ETHUSDC
    const trades = await client.getMyTrades('ETHUSDC', { limit: 200 });
    
    console.log(`📊 Всего сделок: ${trades.length}`);
    
    // Разделяем на покупки и продажи
    const buyTrades = trades.filter(t => !t.isBuyerMaker);
    const sellTrades = trades.filter(t => t.isBuyerMaker);
    
    console.log(`🟢 Покупки (BUY): ${buyTrades.length}`);
    console.log(`🔴 Продажи (SELL): ${sellTrades.length}`);
    
    if (sellTrades.length > 0) {
      console.log('\n🔴 ПОСЛЕДНИЕ ПРОДАЖИ:');
      console.log('====================');
      sellTrades.slice(0, 10).forEach((trade, index) => {
        const time = new Date(trade.time).toLocaleString();
        console.log(`${index + 1}. Продано: ${trade.qty} ETH @ ${trade.price} USDC`);
        console.log(`   Получено: ${trade.quoteQty} USDC`);
        console.log(`   Время: ${time}`);
        console.log('');
      });
    }
    
    // Рассчитываем общую статистику
    let totalETHBought = 0;
    let totalUSDCSpent = 0;
    let totalETHSold = 0;
    let totalUSDCReceived = 0;
    
    buyTrades.forEach(trade => {
      totalETHBought += parseFloat(trade.qty);
      totalUSDCSpent += parseFloat(trade.quoteQty);
    });
    
    sellTrades.forEach(trade => {
      totalETHSold += parseFloat(trade.qty);
      totalUSDCReceived += parseFloat(trade.quoteQty);
    });
    
    console.log('\n📈 ОБЩАЯ СТАТИСТИКА:');
    console.log('====================');
    console.log(`ETH куплено: ${totalETHBought.toFixed(8)}`);
    console.log(`USDC потрачено: ${totalUSDCSpent.toFixed(2)}`);
    console.log(`ETH продано: ${totalETHSold.toFixed(8)}`);
    console.log(`USDC получено: ${totalUSDCReceived.toFixed(2)}`);
    
    const netETH = totalETHBought - totalETHSold;
    const netUSDC = totalUSDCReceived - totalUSDCSpent;
    
    console.log('\n💰 ЧИСТЫЙ РЕЗУЛЬТАТ:');
    console.log('====================');
    console.log(`Чистый ETH: ${netETH.toFixed(8)}`);
    console.log(`Чистый USDC: ${netUSDC.toFixed(2)}`);
    
    if (netUSDC > 0) {
      console.log(`✅ ПРИБЫЛЬ: +${netUSDC.toFixed(2)} USDC`);
    } else {
      console.log(`❌ УБЫТОК: ${netUSDC.toFixed(2)} USDC`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

checkAllTrades();
