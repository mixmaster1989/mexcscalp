#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

async function testTelegramBot() {
    console.log('🧪 ТЕСТ TELEGRAM БОТА');
    console.log('='.repeat(40));
    
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_IDS;
    
    if (!botToken || !chatId) {
        console.log('❌ Telegram настройки не найдены');
        return false;
    }
    
    try {
        console.log('🔄 Отправляю тестовое сообщение...');
        
        const response = await axios.post(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
                chat_id: chatId,
                text: `🧪 ТЕСТОВОЕ СООБЩЕНИЕ

✅ Telegram бот работает корректно
🤖 LLM интеграция готова
📊 Система мониторинга активна

⏰ ${new Date().toLocaleString('ru-RU')}`,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            },
            {
                timeout: 10000
            }
        );
        
        if (response.status === 200) {
            console.log('✅ Telegram бот работает!');
            console.log('📱 Сообщение отправлено в чат');
            return true;
        } else {
            console.log('❌ Ошибка отправки сообщения');
            return false;
        }
        
    } catch (error) {
        console.log('❌ Ошибка Telegram бота:');
        if (error.response) {
            console.log('   Статус:', error.response.status);
            console.log('   Данные:', error.response.data);
        } else {
            console.log('   Ошибка:', error.message);
        }
        return false;
    }
}

testTelegramBot().then(success => {
    process.exit(success ? 0 : 1);
});
