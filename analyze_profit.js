require('dotenv').config();
const { MexcSpotClient } = require('./dist/exchange/mexc-spot');
const axios = require('axios');

async function analyzeProfitability() {
  console.log('💰 АНАЛИЗ ПРИБЫЛЬНОСТИ ТОРГОВЛИ');
  console.log('================================\n');

  try {
    const client = new MexcSpotClient();
    
    // 1. Получаем текущий баланс
    const account = await client.getAccountInfo();
    const balances = account.balances || [];
    const ethBalance = balances.find(b => b.asset === 'ETH');
    const usdcBalance = balances.find(b => b.asset === 'USDC');
    
    if (!ethBalance) {
      console.log('❌ ETH баланс не найден');
      return;
    }
    
    const totalETH = parseFloat(ethBalance.free) + parseFloat(ethBalance.locked);
    const totalUSDC = parseFloat(usdcBalance.free) + parseFloat(usdcBalance.locked);
    
    console.log('📊 ТЕКУЩИЙ БАЛАНС:');
    console.log(`ETH: ${totalETH.toFixed(8)}`);
    console.log(`USDC: ${totalUSDC.toFixed(2)}`);
    
    // 2. Получаем историю покупок ETHUSDC
    const trades = await client.getMyTrades('ETHUSDC', { limit: 100 });
    const buyTrades = trades.filter(t => !t.isBuyerMaker); // BUY сделки
    
    if (buyTrades.length === 0) {
      console.log('❌ Нет сделок покупки ETH');
      return;
    }
    
    // 3. Рассчитываем среднюю цену покупки
    let totalETHBought = 0;
    let totalUSDCSpent = 0;
    let totalCommission = 0;
    
    console.log('\n📈 АНАЛИЗ ПОКУПОК ETH:');
    console.log('========================');
    
    buyTrades.forEach((trade, index) => {
      const qty = parseFloat(trade.qty);
      const price = parseFloat(trade.price);
      const amount = parseFloat(trade.quoteQty);
      const commission = parseFloat(trade.commission || 0);
      
      totalETHBought += qty;
      totalUSDCSpent += amount;
      totalCommission += commission;
      
      if (index < 5) { // Показываем первые 5 сделок
        console.log(`${index + 1}. Куплено: ${qty.toFixed(8)} ETH @ ${price.toFixed(2)} USDC`);
        console.log(`   Потрачено: ${amount.toFixed(2)} USDC`);
      }
    });
    
    const avgBuyPrice = totalUSDCSpent / totalETHBought;
    
    console.log(`\n📊 СТАТИСТИКА ПОКУПОК:`);
    console.log(`Всего ETH куплено: ${totalETHBought.toFixed(8)}`);
    console.log(`Потрачено USDC: ${totalUSDCSpent.toFixed(2)}`);
    console.log(`Средняя цена покупки: ${avgBuyPrice.toFixed(2)} USDC`);
    console.log(`Комиссия: ${totalCommission.toFixed(2)} USDC`);
    
    // 4. Получаем текущую цену ETH
    const priceResponse = await axios.get('https://api.mexc.com/api/v3/ticker/price?symbol=ETHUSDC');
    const currentPrice = parseFloat(priceResponse.data.price);
    
    console.log(`\n💹 ТЕКУЩАЯ ЦЕНА ETH: ${currentPrice.toFixed(2)} USDC`);
    
    // 5. Рассчитываем прибыль/убыток
    const currentValue = totalETH * currentPrice;
    const profitLoss = currentValue - totalUSDCSpent;
    const profitPercent = (profitLoss / totalUSDCSpent) * 100;
    
    console.log(`\n💰 РАСЧЕТ ПРИБЫЛЬНОСТИ:`);
    console.log(`Текущая стоимость ETH: ${currentValue.toFixed(2)} USDC`);
    console.log(`Потрачено на покупку: ${totalUSDCSpent.toFixed(2)} USDC`);
    console.log(`Прибыль/Убыток: ${profitLoss.toFixed(2)} USDC (${profitPercent.toFixed(2)}%)`);
    
    // 6. Анализ по времени
    const firstTrade = buyTrades[buyTrades.length - 1]; // Самая старая сделка
    const lastTrade = buyTrades[0]; // Самая новая сделка
    
    console.log(`\n⏰ ВРЕМЕННОЙ АНАЛИЗ:`);
    console.log(`Первая сделка: ${new Date(firstTrade.time).toLocaleString()}`);
    console.log(`Последняя сделка: ${new Date(lastTrade.time).toLocaleString()}`);
    
    // 7. Рекомендации
    console.log(`\n🎯 РЕКОМЕНДАЦИИ:`);
    if (profitPercent > 0) {
      console.log(`✅ Торговля прибыльна! +${profitPercent.toFixed(2)}%`);
      console.log(`💡 Рассмотрите возможность фиксации части прибыли`);
    } else {
      console.log(`❌ Торговля убыточна: ${profitPercent.toFixed(2)}%`);
      console.log(`💡 Рассмотрите изменение стратегии или ожидание роста цены`);
    }
    
    // 8. Анализ эффективности сетки
    const priceRange = Math.max(...buyTrades.map(t => parseFloat(t.price))) - 
                      Math.min(...buyTrades.map(t => parseFloat(t.price)));
    const avgTradeSize = totalUSDCSpent / buyTrades.length;
    
    console.log(`\n📊 АНАЛИЗ СТРАТЕГИИ:`);
    console.log(`Диапазон цен: ${priceRange.toFixed(2)} USDC`);
    console.log(`Средний размер сделки: ${avgTradeSize.toFixed(2)} USDC`);
    console.log(`Количество сделок: ${buyTrades.length}`);
    
  } catch (error) {
    console.error('❌ Ошибка при анализе:', error.message);
  }
}

analyzeProfitability();
