#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const scalperEnhancer_1 = require("../core/scalperEnhancer");
const mexcRest_1 = require("../infra/mexcRest");
(0, dotenv_1.config)();
async function testEnhancedScalper() {
    try {
        console.log('🧪 ТЕСТИРОВАНИЕ УЛУЧШЕННОГО СКАЛЬПЕРА');
        // Проверяем API ключи
        const apiKey = process.env.MEXC_API_KEY;
        const secretKey = process.env.MEXC_SECRET_KEY;
        if (!apiKey || !secretKey) {
            throw new Error('Не найдены API ключи MEXC в переменных окружения');
        }
        // Создаем REST клиент
        const restClient = new mexcRest_1.MexcRestClient(apiKey, secretKey);
        // Создаем инструмент ETHUSDC
        const instrument = {
            symbol: 'ETHUSDC',
            baseAsset: 'ETH',
            quoteAsset: 'USDC',
            tickSize: 0.01,
            stepSize: 0.000001,
            minNotional: 1.0,
            maxNotional: 1000000,
            minQty: 0.000001,
            maxQty: 1000
        };
        // Создаем конфигурацию по умолчанию
        const config = (0, scalperEnhancer_1.createDefaultConfig)();
        console.log('📋 Конфигурация:', JSON.stringify(config, null, 2));
        // Создаем улучшенный скальпер
        const enhancer = new scalperEnhancer_1.ScalperEnhancer(config, restClient, instrument);
        // Запускаем
        await enhancer.start();
        // Получаем текущие ордера
        console.log('\n📊 Получаем текущие ордера...');
        const openOrders = await restClient.getOpenOrders('ETHUSDC');
        console.log(`Найдено ${openOrders.length} открытых ордеров`);
        // Получаем рыночные данные
        console.log('\n💰 Получаем рыночные данные...');
        const price = await restClient.getPrice('ETHUSDC');
        console.log(`Текущая цена ETH: $${price}`);
        // Тестируем управление ордерами
        console.log('\n🔄 Тестируем управление ордерами...');
        await enhancer.manageOrders(openOrders);
        // Получаем статистику
        console.log('\n📈 Статистика:');
        const stats = enhancer.getStats();
        console.log(JSON.stringify(stats, null, 2));
        // Останавливаем
        await enhancer.stop();
        console.log('\n✅ Тестирование завершено успешно!');
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('\n❌ Ошибка:', errorMessage);
        process.exit(1);
    }
}
if (require.main === module) {
    testEnhancedScalper();
}
//# sourceMappingURL=enhancedScalper.js.map