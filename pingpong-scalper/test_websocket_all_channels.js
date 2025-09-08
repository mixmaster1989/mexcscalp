const WebSocket = require('ws');

console.log('🔍 ТЕСТ ВСЕХ КАНАЛОВ ДЛЯ ETHUSDC');

const wsUrl = 'wss://wbs-api.mexc.com/ws';

// Создаем множественные тесты для разных каналов
const testChannels = [
  'spot@public.aggre.bookTicker.v3.api.pb@100ms@ETHUSDC',
  'spot@public.aggre.deals.v3.api.pb@100ms@ETHUSDC',
  'spot@public.aggre.bookTicker.v3.api.pb@100ms@ETHUSDT',
  'spot@public.aggre.deals.v3.api.pb@100ms@ETHUSDT',
  'spot@public.bookTicker@ETHUSDC',
  'spot@public.deals@ETHUSDC',
  'spot@public.bookTicker@ETHUSDT',
  'spot@public.deals@ETHUSDT'
];

function testChannel(channel) {
  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl);
    let gotData = false;
    
    const timeout = setTimeout(() => {
      ws.close();
      resolve({ channel, success: false, reason: 'timeout' });
    }, 8000);
    
    ws.on('open', () => {
      console.log(`✅ Подключился для ${channel}`);
      
      const sub = { method: 'SUBSCRIPTION', params: [channel] };
      ws.send(JSON.stringify(sub));
      console.log(`📡 Отправил подписку: ${channel}`);
    });
    
    ws.on('message', (data) => {
      if (!gotData) {
        gotData = true;
        clearTimeout(timeout);
        ws.close();
        
        console.log(`🎉 ПОЛУЧИЛ ДАННЫЕ ОТ ${channel}!`);
        console.log(`📨 Тип: ${typeof data}, Размер: ${data.length} байт`);
        console.log(`📨 Превью: ${data.toString().substring(0, 100)}`);
        
        resolve({ channel, success: true, data: data.toString().substring(0, 100) });
      }
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      resolve({ channel, success: false, reason: error.message });
    });
  });
}

async function testAllChannels() {
  console.log('🚀 Тестируем все каналы...');
  
  for (const channel of testChannels) {
    console.log(`\n🔍 Тестируем: ${channel}`);
    const result = await testChannel(channel);
    
    if (result.success) {
      console.log(`✅ РАБОТАЕТ: ${result.channel}`);
      console.log(`   Данные: ${result.data}`);
    } else {
      console.log(`❌ НЕ РАБОТАЕТ: ${result.channel} (${result.reason})`);
    }
    
    // Пауза между тестами
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🏁 Тестирование завершено');
}

testAllChannels().catch(console.error);
