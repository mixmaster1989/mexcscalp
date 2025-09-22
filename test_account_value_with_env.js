require('dotenv').config();
const { TelegramNotifier } = require('./dist/telegram/telegram-notifier');

async function testAccountValue() {
    console.log('🧪 Тестируем получение полной стоимости аккаунта...');
    
    // Проверяем наличие переменных окружения
    if (!process.env.MEXC_API_KEY || !process.env.MEXC_SECRET_KEY) {
        console.log('⚠️ Переменные окружения MEXC_API_KEY и MEXC_SECRET_KEY не настроены');
        console.log('Создайте .env файл с этими переменными для тестирования');
        return;
    }
    
    try {
        // Создаем экземпляр TelegramNotifier (можно с пустыми параметрами для теста)
        const notifier = new TelegramNotifier('dummy_token', '123456789');
        
        // Получаем стоимость аккаунта
        const accountValue = await notifier.getAccountValue();
        
        console.log('💰 Результат:');
        console.log(`Общая стоимость: $${accountValue.totalValueUSDT} USDT`);
        console.log('Активы:');
        accountValue.balances.forEach(balance => {
            console.log(`  ${balance.asset}: ${balance.total} ($${balance.valueUSDT})`);
        });
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    }
}

testAccountValue();
