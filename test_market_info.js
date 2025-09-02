require('dotenv').config();
const { MexcRestClient } = require('./dist/infra/mexcRest');
const TelegramBot = require('node-telegram-bot-api');
const Mexc = require('mexc-api-sdk');

const MEXC_API_KEY = process.env.MEXC_API_KEY;
const MEXC_SECRET_KEY = process.env.MEXC_SECRET_KEY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_IDS;

async function getMarketInfo() {
  const bot = new TelegramBot(TELEGRAM_TOKEN);
  const client = new MexcRestClient(MEXC_API_KEY, MEXC_SECRET_KEY);
  
  try {
    console.log('🎯 ПОЛУЧАЮ РЫНОЧНУЮ ИНФОРМАЦИЮ ПО ETH/USDC (SPOT)!');
    
    // Получаем информацию об инструменте
    console.log('📊 Получаю информацию об инструменте...');
    const instruments = await client.getExchangeInfo('ETH/USDC');
    const instrument = instruments[0];
    console.log('✅ Инструмент получен');
    
    // Получаем текущую цену
    console.log('💰 Получаю текущую цену...');
    const currentPrice = await client.getPrice('ETH/USDC');
    console.log('✅ Цена получена:', currentPrice);
    
    // Получаем стакан
    console.log('📚 Получаю стакан...');
    const bookTicker = await client.getBookTicker('ETH/USDC');
    console.log('✅ Стакан получен');
    
    // Получаем баланс
    console.log('�� Получаю баланс...');
    const accountInfo = await client.getAccountInfo();
    console.log('✅ Баланс получен');
    
    // Получаем 24h статистику (через ticker24hr)
    console.log('📈 Получаю 24h статистику...');
    const spotClient = new Mexc.Spot(MEXC_API_KEY, MEXC_SECRET_KEY);
    const ticker24h = await spotClient.ticker24hr('ETHUSDC');
    console.log('✅ 24h статистика получена');
    
    // Получаю глубину стакана
    console.log('�� Получаю глубину стакана...');
    const depth = await spotClient.depth('ETHUSDC', { limit: 5 });
    console.log('✅ Глубина стакана получена');
    
    // Получаю последние сделки
    console.log('🔄 Получаю последние сделки...');
    const trades = await spotClient.trades('ETHUSDC', { limit: 5 });
    console.log('✅ Сделки получены');
    
    // Форматирую и вывожу информацию
    const spread = bookTicker.askPrice - bookTicker.bidPrice;
    const spreadPercent = ((spread / currentPrice) * 100).toFixed(3);
    
    let message = '🎯 MEXC SCALP BOT - Рыночная информация (SDK v3)\n\n';
    message += '📊 Инструмент: ETH/USDC\n';
    message += '┌─────────────────────────\n';
    message += '│ 💰 Текущая цена: $' + currentPrice.toFixed(4) + '\n';
    message += '│ 📈 Bid: $' + bookTicker.bidPrice.toFixed(4) + '\n';
    message += '│ 📉 Ask: $' + bookTicker.askPrice.toFixed(4) + '\n';
    message += '│ 📏 Спред: $' + spread.toFixed(4) + ' (' + spreadPercent + '%)\n';
    message += '└─────────────────────────\n\n';
    
    message += '🔧 Параметры инструмента:\n';
    message += '┌─────────────────────────\n';
    message += '│ 🎯 Tick Size: ' + (instrument?.tickSize || 'N/A') + '\n';
    message += '│ 📦 Step Size: ' + (instrument?.stepSize || 'N/A') + '\n';
    message += '│ �� Min Notional: ' + (instrument?.minNotional || 'N/A') + '\n';
    message += '│ 📊 Status: ' + (instrument ? '1' : 'N/A') + '\n';
    message += '└─────────────────────────\n\n';
    
    message += '📈 24h Статистика:\n';
    message += '┌─────────────────────────\n';
    message += '│ 🔄 Объем: ' + ticker24h.volume + ' ETH\n';
    message += '│ 💰 Объем USDC: $' + ticker24h.quoteVolume + '\n';
    message += '│ 📊 Изменение: ' + ticker24h.priceChangePercent + '%\n';
    message += '│ ⬆️ Максимум: $' + ticker24h.highPrice + '\n';
    message += '│ ⬇️ Минимум: $' + ticker24h.lowPrice + '\n';
    message += '│ 📈 Сделок: ' + (ticker24h.count || 'null') + '\n';
    message += '└─────────────────────────\n\n';
    
    const ethBalance = accountInfo.balances.find(b => b.asset === 'ETH');
    const usdcBalance = accountInfo.balances.find(b => b.asset === 'USDC');
    
    message += '💳 Баланс аккаунта:\n';
    message += '┌─────────────────────────\n';
    message += '│ 🪙 ETH: ' + (ethBalance?.free || 0) + ' (свободно)\n';
    message += '│ 🔒 ETH: ' + (ethBalance?.locked || 0) + ' (заблок.)\n';
    message += '│ 💵 USDC: ' + (usdcBalance?.free || 0) + ' (свободно)\n';
    message += '│ 🔒 USDC: ' + (usdcBalance?.locked || 0) + ' (заблок.)\n';
    message += '└─────────────────────────\n\n';
    
    message += '📚 Топ стакана:\n';
    message += 'Продажи (Ask):\n';
    depth.asks.slice(0, 5).forEach(function(ask) {
      message += parseFloat(ask[0]).toFixed(4) + ' - ' + parseFloat(ask[1]).toFixed(4) + '\n';
    });
    message += '────────────────\n';
    message += 'Покупки (Bid):\n';
    depth.bids.slice(0, 5).forEach(function(bid) {
      message += parseFloat(bid[0]).toFixed(4) + ' - ' + parseFloat(bid[1]).toFixed(4) + '\n';
    });
    message += '\n';
    
    message += '🔄 Последние сделки:\n';
    trades.slice(0, 5).forEach(function(trade) {
      const color = trade.side === 'BUY' ? '🟢' : '🔴';
      message += color + ' $' + parseFloat(trade.price).toFixed(4) + ' × ' + parseFloat(trade.qty).toFixed(4) + '\n';
    });
    message += '\n';
    
    // Рекомендации для скальпинга
    const recommendedOffset = spread * 2;
    const stepSize = spread * 1.5;
    const minTradeSize = instrument?.minNotional || 1.5;
    
    message += '⚙️ Настройки для скальпинга:\n';
    message += '┌─────────────────────────\n';
    message += '│ 🎯 Рекомендуемый offset: ~$' + recommendedOffset.toFixed(4) + '\n';
    message += '│ 📏 Шаг между уровнями: ~$' + stepSize.toFixed(4) + '\n';
    message += '│ 💰 Мин. размер сделки: ~$' + minTradeSize.toFixed(2) + '\n';
    message += '│ 🎪 Уровней Ёршиков: 4 на сторону\n';
    message += '│ 🎯 Take Profit: 12 bps (0.12%)\n';
    message += '└─────────────────────────\n\n';
    
    message += '🚀 Система готова к торговле!\n';
    message += '⏰ Время получения: ' + new Date().toLocaleString('ru-RU');
    
    console.log('\n' + message);
    
    await bot.sendMessage(CHAT_ID, message);
    console.log('✅ Полная рыночная информация отправлена в Telegram!');
    
  } catch (error) {
    console.error('❌ Ошибка получения информации:', error.message);
    if (error.response) {
      console.error('Ответ:', error.response);
    }
    
    const errorMessage = '❌ ОШИБКА ПОЛУЧЕНИЯ РЫНОЧНОЙ ИНФОРМАЦИИ:\n\n' + error.message + '\n\nОтвет: ' + JSON.stringify(error.response || {});
    await bot.sendMessage(CHAT_ID, errorMessage);
  }
}

getMarketInfo();
