require('dotenv').config();
const { MexcRestClient } = require('./dist/infra/mexcRest');

console.log('🔍 АНАЛИЗ РАБОТЫ СКАЛЬПЕРА...\n');

const client = new MexcRestClient(process.env.MEXC_API_KEY, process.env.MEXC_SECRET_KEY);

async function analyzeScalper() {
  try {
    // 1. Проверяем баланс
    console.log('1️⃣ ТЕКУЩИЙ БАЛАНС:');
    const account = await client.getAccountInfo();
    const eth = account.balances.find(b => b.asset === 'ETH');
    const usdc = account.balances.find(b => b.asset === 'USDC');
    
    console.log('   🪙 ETH свободно:', eth?.free || 0);
    console.log('   🔒 ETH заблокировано:', eth?.locked || 0);
    console.log('   💵 USDC свободно:', usdc?.free || 0);
    console.log('   🔒 USDC заблокировано:', usdc?.locked || 0);
    
    // 2. Проверяем активные ордера
    console.log('\n2️⃣ АКТИВНЫЕ ОРДЕРА:');
    const orders = await client.getOpenOrders('ETH/USDC');
    console.log('   📊 Всего ордеров:', orders.length);
    
    if (orders.length > 0) {
      orders.forEach((order, i) => {
        const side = order.side === 'buy' ? '🟢 BUY' : '🔴 SELL';
        const age = Math.floor((Date.now() - order.timestamp) / 1000 / 60); // минуты
        console.log('   ' + (i+1) + '. ' + side + ' ' + order.price + ' x ' + order.quantity + ' (' + age + ' мин)');
      });
    }
    
    // 3. Проверяем последние сделки
    console.log('\n3️⃣ ПОСЛЕДНИЕ СДЕЛКИ:');
    const trades = await client.getMyTrades('ETH/USDC', 5);
    console.log('   📊 Всего сделок:', trades.length);
    
    if (trades.length > 0) {
      trades.forEach((trade, i) => {
        const side = trade.side === 'buy' ? '🟢 BUY' : '🔴 SELL';
        const time = new Date(trade.timestamp).toLocaleTimeString('ru-RU');
        console.log('   ' + (i+1) + '. ' + side + ' ' + trade.price + ' x ' + trade.quantity + ' (' + time + ')');
      });
    }
    
    // 4. Анализируем работу
    console.log('\n4️⃣ АНАЛИЗ РАБОТЫ:');
    
    // Проверяем, есть ли ETH для торговли
    const hasETH = parseFloat(eth?.free || '0') > 0.0001;
    const hasUSDC = parseFloat(usdc?.free || '0') > 10;
    
    console.log('   ✅ ETH для продажи:', hasETH ? 'ЕСТЬ' : 'НЕТ');
    console.log('   ✅ USDC для покупки:', hasUSDC ? 'ЕСТЬ' : 'НЕТ');
    
    // Проверяем ордера
    const buyOrders = orders.filter(o => o.side === 'buy').length;
    const sellOrders = orders.filter(o => o.side === 'sell').length;
    
    console.log('   📈 Buy ордеров:', buyOrders);
    console.log('   📉 Sell ордеров:', sellOrders);
    
    // Проверяем рыночную ситуацию
    console.log('\n5️⃣ РЫНОЧНАЯ СИТУАЦИЯ:');
    const price = await client.getPrice('ETH/USDC');
    const bookTicker = await client.getBookTicker('ETH/USDC');
    
    console.log('   💰 Текущая цена:', price.toFixed(2));
    console.log('   📏 Спред:', (bookTicker.askPrice - bookTicker.bidPrice).toFixed(2));
    
    // Анализ ордеров по отношению к рынку
    console.log('\n6️⃣ АНАЛИЗ ОРДЕРОВ:');
    
    orders.forEach((order, i) => {
      const distance = order.side === 'buy' ? 
        price - order.price : 
        order.price - price;
      
      const distancePercent = (distance / price * 100).toFixed(2);
      const status = distance > 0 ? 'ВЫГОДНЫЙ' : 'НЕВЫГОДНЫЙ';
      
      console.log('   Ордер ' + (i+1) + ': ' + status + ' (' + distancePercent + '% от рынка)');
    });
    
    // Выводы
    console.log('\n🎯 ВЫВОДЫ:');
    
    let issues = [];
    
    if (!hasETH && !hasUSDC) {
      issues.push('❌ Недостаточно средств для торговли');
    }
    
    if (orders.length === 0) {
      issues.push('⚠️ Нет активных ордеров');
    }
    
    if (buyOrders === 0) {
      issues.push('⚠️ Нет ордеров на покупку');
    }
    
    if (sellOrders === 0 && hasETH) {
      issues.push('⚠️ Нет ордеров на продажу при наличии ETH');
    }
    
    const spread = bookTicker.askPrice - bookTicker.bidPrice;
    if (spread > 5) {
      issues.push('⚠️ Большой спред (>5 USDC)');
    }
    
    if (issues.length === 0) {
      console.log('   ✅ Система работает корректно!');
      console.log('   ✅ Есть средства для торговли');
      console.log('   ✅ Ордера размещены правильно');
      console.log('   ✅ Рыночная ситуация нормальная');
    } else {
      console.log('   ⚠️ ОБНАРУЖЕНЫ ПРОБЛЕМЫ:');
      issues.forEach(issue => console.log('     ' + issue));
    }
    
  } catch (error) {
    console.error('❌ ОШИБКА АНАЛИЗА:', error.message);
  }
}

analyzeScalper();
