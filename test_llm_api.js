#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

async function testLLMAPI() {
    console.log('🧪 ТЕСТ CLOUD.RU LLM API');
    console.log('='.repeat(40));
    
    try {
        console.log('🔄 Отправляю запрос к Cloud.ru LLM...');
        
        const response = await axios.post(
            'https://foundation-models.api.cloud.ru/v1/chat/completions',
            {
                model: 'openai/gpt-oss-120b',
                messages: [
                    {
                        role: 'user',
                        content: 'Привет! Это тест API. Ответь коротко "API работает"'
                    }
                ],
                max_tokens: 20,
                temperature: 0.1
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.LLM_API}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 секунд
            }
        );
        
        console.log('✅ Статус ответа:', response.status);
        console.log('📝 Ответ LLM:', response.data.choices[0].message.content);
        console.log('🎉 Cloud.ru LLM API работает!');
        
        return true;
        
    } catch (error) {
        console.log('❌ Ошибка Cloud.ru LLM API:');
        if (error.response) {
            console.log('   Статус:', error.response.status);
            console.log('   Данные:', error.response.data);
        } else if (error.request) {
            console.log('   Таймаут или сетевая ошибка');
        } else {
            console.log('   Ошибка:', error.message);
        }
        return false;
    }
}

testLLMAPI().then(success => {
    process.exit(success ? 0 : 1);
});
