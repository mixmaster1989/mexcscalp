const axios = require('axios');

async function testCloudLLM() {
  const apiKey = process.env.LLM_API;
  if (!apiKey) {
    console.error('❌ LLM_API не найден в .env');
    return;
  }

  console.log('🧠 Тестируем Cloud.ru LLM API...');
  console.log('🔑 API ключ:', apiKey.substring(0, 10) + '...');
  
  try {
    const response = await axios.post(
      'https://foundation-models.api.cloud.ru/v1/chat/completions',
      {
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: 'Привет! Это тест. Ответь коротко.' }],
        temperature: 0.7,
        max_tokens: 100
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('✅ Cloud.ru LLM ответ:', response.data.choices[0].message.content);
  } catch (error) {
    console.error('❌ Ошибка Cloud.ru LLM:', error.response?.status, error.response?.data);
  }
}

testCloudLLM();
