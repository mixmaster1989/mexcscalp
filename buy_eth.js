require('dotenv').config();
const { MexcRestClient } = require('./dist/infra/mexcRest');

console.log('💰 ПОКУПКА ETH НА 50 USDC...\n');

const client = new MexcRestClient(process.env.MEXC_API_KEY, process.env.MEXC_SECRET_KEY);

async function buyETH() {
  try {
    // Проверяем баланс перед покупкой
    console.log('1️⃣ ПРОВЕРКА БАЛАНСА:');
    const account = await client.getAccountInfo();
    const usdc = account.balances.find(b => b.asset === 'USDC');
    const eth = account.balances.find(b => b.asset === 'ETH');
    
    console.log('   💵 USDC свободно:', usdc?.free || 0);
    console.log('   🪙 ETH свободно:', eth?.free || 0);
    
    if (parseFloat(usdc?.free || '0') < 50) {
      throw new Error('Недостаточно USDC для покупки!');
    }
    
    // Получаем текущую цену ETH
    console.log('\n2️⃣ ПОЛУЧЕНИЕ ЦЕНЫ:');
    const price = await client.getPrice('ETH/USDC');
    console.log('   💰 Текущая цена ETH:', price.toFixed(2), 'USDC');
    
    // Рассчитываем количество ETH и округляем до step size 0.0001
    const usdcAmount = 50;
    const stepSize = 0.0001; // Стандартный step size для ETH на MEXC
    const ethQuantity = Math.floor((usdcAmount / price) / stepSize) * stepSize;
    console.log('   📊 Количество ETH для покупки:', ethQuantity.toFixed(6));
    console.log('   📏 Step size:', stepSize);
    
    // Устанавливаем цену немного выше текущей для гарантированного исполнения
    const buyPrice = Math.ceil(price * 1.001 * 100) / 100; // +0.1% к текущей цене
    console.log('   💰 Цена покупки:', buyPrice.toFixed(2), 'USDC (+0.1%)');
    
    // Создаем лимитный ордер на покупку
    console.log('\n3️⃣ СОЗДАНИЕ ОРДЕРА:');
    console.log('   🟢 BUY ETH/USDC');
    console.log('   💰 Сумма:', usdcAmount, 'USDC');
    console.log('   📊 Количество:', ethQuantity.toFixed(6), 'ETH');
    console.log('   🎯 Тип: LIMIT (лимитный)');
    console.log('   💰 Цена:', buyPrice.toFixed(2), 'USDC');
    
    // Проверяем, не в режиме DRY_RUN ли мы
    if (process.env.DRY_RUN === 'true') {
      console.log('\n⚠️ DRY_RUN режим - ордер НЕ создается!');
      console.log('   Для реальной покупки установите DRY_RUN=false');
      return;
    }
    
    // Создаем ордер используя правильный метод
    const order = await client.placeOrder(
      'ETH/USDC',           // symbol
      'buy',                // side
      'LIMIT',              // type
      ethQuantity,          // quantity
      buyPrice,             // price
      `BUY_ETH_${Date.now()}` // clientOrderId
    );
    
    console.log('\n✅ ОРДЕР СОЗДАН!');
    console.log('   🆔 ID ордера:', order.id);
    console.log('   📊 Статус:', order.status);
    console.log('   💰 Цена:', order.price);
    console.log('   📈 Количество:', order.quantity);
    
    // Ждем немного и проверяем статус
    console.log('\n4️⃣ ПРОВЕРКА СТАТУСА:');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const orderStatus = await client.getOrder('ETH/USDC', order.id);
    console.log('   📊 Статус ордера:', orderStatus.status);
    console.log('   💰 Исполнено:', orderStatus.filled);
    console.log('   📈 Осталось:', orderStatus.remaining);
    
    // Проверяем новый баланс
    console.log('\n5️⃣ НОВЫЙ БАЛАНС:');
    const newAccount = await client.getAccountInfo();
    const newEth = newAccount.balances.find(b => b.asset === 'ETH');
    const newUsdc = newAccount.balances.find(b => b.asset === 'USDC');
    
    console.log('   🪙 ETH свободно:', newEth?.free || 0);
    console.log('   💵 USDC свободно:', newUsdc?.free || 0);
    
    const ethGained = parseFloat(newEth?.free || '0') - parseFloat(eth?.free || '0');
    const usdcSpent = parseFloat(usdc?.free || '0') - parseFloat(newUsdc?.free || '0');
    
    console.log('\n🎯 ИТОГИ ПОКУПКИ:');
    console.log('   🟢 Получено ETH:', ethGained.toFixed(6));
    console.log('   🔴 Потрачено USDC:', usdcSpent.toFixed(2));
    
    console.log('\n🚀 Теперь у скальпера есть чем торговать!');
    
  } catch (error) {
    console.error('❌ ОШИБКА ПОКУПКИ:', error.message);
    
    if (error.message.includes('insufficient')) {
      console.log('\n💡 Возможные решения:');
      console.log('1. Проверьте баланс USDC');
      console.log('2. Уменьшите сумму покупки');
      console.log('3. Дождитесь пополнения баланса');
    }
  }
}

buyETH(); 