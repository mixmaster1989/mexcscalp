const axios = require('axios');

async function testLLM() {
  const apiKey = process.env.LLM_API;
  if (!apiKey) {
    console.error('❌ LLM_API не найден в .env');
    return;
  }

  console.log('🧠 Тестируем LLM API...');
  
  try {
    const response = await axios.post(
      'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
      {
        model: 'GigaChat:latest',
        messages: [{ role: 'user', content: 'Привет! Это тест. Ответь коротко.' }],
        temperature: 0.7,
        max_tokens: 100
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000,
        httpsAgent: new (require("https").Agent)({ rejectUnauthorized: false })
      }
    );

    console.log('✅ LLM ответ:', response.data.choices[0].message.content);
  } catch (error) {
    console.error('❌ Ошибка LLM:', error.response?.status, error.response?.data);
  }
}

testLLM();
