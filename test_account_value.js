const { TelegramNotifier } = require('./dist/telegram/telegram-notifier');

async function testAccountValue() {
    console.log('🧪 Тестируем получение полной стоимости аккаунта...');
    
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
