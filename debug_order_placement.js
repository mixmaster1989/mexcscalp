require('dotenv').config();
const { MexcRestClient } = require('./dist/infra/mexcRest');

const client = new MexcRestClient(process.env.MEXC_API_KEY, process.env.MEXC_SECRET_KEY);

async function debugOrderPlacement() {
  try {
    console.log('🔧 ДЕБАГ РАЗМЕЩЕНИЯ ОРДЕРОВ...\n');
    
    // Получаем текущую цену
    const price = await client.getPrice('ETH/USDC');
    console.log('💰 Текущая цена:', price);
    
    // Пробуем разместить один простой ордер
    const testPrice = price - 10; // Ниже текущей цены
    const roundedPrice = Math.round(testPrice * 100) / 100;
    const qty = 0.000345;
    
    console.log('�� Параметры тестового ордера:');
    console.log('   Symbol: ETH/USDC');
    console.log('   Side: BUY');
    console.log('   Type: LIMIT');
    console.log('   Price:', roundedPrice);
    console.log('   Quantity:', qty);
    
    const timestamp = Date.now();
    const clientOrderId = `DEBUG_BUY_${timestamp}`;
    console.log('   ClientOrderId:', clientOrderId);
    
    console.log('\n🔄 Пробуем разместить ордер...');
    
    const result = await client.placeOrder(
      'ETH/USDC',
      'buy',
      'limit',
      qty,
      roundedPrice,
      clientOrderId
    );
    
    console.log('✅ Ордер размещен:', result);
    
  } catch (error) {
    console.log('❌ ДЕТАЛЬНАЯ ОШИБКА:', error);
    console.log('   Код ошибки:', error.code);
    console.log('   Сообщение:', error.message);
    console.log('   Response:', error.response?.data);
    console.log('   Status:', error.response?.status);
    
    if (error.response?.data) {
      console.log('\n🔍 ПОДРОБНЫЙ АНАЛИЗ:');
      console.log('   Тип ошибки:', typeof error.response.data);
      console.log('   Ключи:', Object.keys(error.response.data));
      console.log('   Полный ответ:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

debugOrderPlacement();
