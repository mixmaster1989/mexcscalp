const WebSocket = require('ws');

console.log('🔍 ТЕСТ ВСЕХ WEBSOCKET ENDPOINTS MEXC!');

const endpoints = [
  'wss://wbs-api.mexc.com/ws',
  'wss://wbs.mexc.com/ws',
  'wss://api.mexc.com/ws',
  'wss://stream.mexc.com/ws',
  'wss://ws.mexc.com/ws',
  'wss://wbs-api.mexc.com/spot',
  'wss://wbs.mexc.com/spot'
];

const channels = [
  'spot@public.aggre.bookTicker.v3.api.pb@100ms@ETHUSDT',
  'spot@public.aggre.deals.v3.api.pb@100ms@ETHUSDT',
  'spot@public.aggre.depth.v3.api.pb@100ms@ETHUSDT',
  'spot@public.bookTicker@ETHUSDT',
  'spot@public.deals@ETHUSDT',
  'spot@public.depth@ETHUSDT',
  'ETHUSDT@bookTicker',
  'ETHUSDT@deals',
  'ETHUSDT@depth',
  'bookTicker@ETHUSDT',
  'deals@ETHUSDT',
  'depth@ETHUSDT'
];

let testCount = 0;
let successCount = 0;

function testEndpoint(endpoint, channel) {
  return new Promise((resolve) => {
    const ws = new WebSocket(endpoint);
    let gotData = false;
    
    const timeout = setTimeout(() => {
      ws.close();
      resolve({ endpoint, channel, success: false, reason: 'timeout' });
    }, 5000);
    
    ws.on('open', () => {
      console.log(`✅ Подключился к ${endpoint}`);
      
      // Пробуем разные форматы подписки
      const subscriptions = [
        JSON.stringify({ method: 'SUBSCRIPTION', params: [channel] }),
        JSON.stringify({ op: 'subscribe', args: [channel] }),
        JSON.stringify({ subscribe: channel }),
        JSON.stringify({ channel: channel }),
        channel
      ];
      
      subscriptions.forEach((sub, i) => {
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(sub);
            console.log(`📡 Отправил подписку ${i+1}: ${sub.substring(0, 100)}...`);
          }
        }, i * 500);
      });
    });
    
    ws.on('message', (data) => {
      gotData = true;
      clearTimeout(timeout);
      ws.close();
      
      console.log(`🎉 ПОЛУЧИЛ ДАННЫЕ!`);
      console.log(`📨 Тип данных: ${typeof data}`);
      console.log(`📨 Размер: ${data.length} байт`);
      console.log(`📨 Первые 200 символов: ${data.toString().substring(0, 200)}`);
      
      resolve({ 
        endpoint, 
        channel, 
        success: true, 
        dataType: typeof data,
        dataSize: data.length,
        preview: data.toString().substring(0, 200)
      });
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      resolve({ endpoint, channel, success: false, reason: error.message });
    });
    
    ws.on('close', () => {
      if (!gotData) {
        clearTimeout(timeout);
        resolve({ endpoint, channel, success: false, reason: 'closed without data' });
      }
    });
  });
}

async function runAllTests() {
  console.log(`🚀 Запускаю ${endpoints.length * channels.length} тестов...`);
  
  for (const endpoint of endpoints) {
    for (const channel of channels) {
      testCount++;
      console.log(`\n🔍 Тест ${testCount}: ${endpoint} + ${channel}`);
      
      const result = await testEndpoint(endpoint, channel);
      
      if (result.success) {
        successCount++;
        console.log(`🎉 УСПЕХ! Найдены данные:`);
        console.log(`   Endpoint: ${result.endpoint}`);
        console.log(`   Channel: ${result.channel}`);
        console.log(`   Тип: ${result.dataType}`);
        console.log(`   Размер: ${result.dataSize}`);
        console.log(`   Превью: ${result.preview}`);
        console.log(`\n🔥 ЭТО РАБОТАЕТ! ИСПОЛЬЗУЙ ЭТО! 🔥\n`);
        return; // Останавливаем на первом успехе
      } else {
        console.log(`❌ Не сработало: ${result.reason}`);
      }
      
      // Пауза между тестами
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`\n📊 РЕЗУЛЬТАТЫ:`);
  console.log(`   Всего тестов: ${testCount}`);
  console.log(`   Успешных: ${successCount}`);
  console.log(`   Неудачных: ${testCount - successCount}`);
}

runAllTests().catch(console.error);
