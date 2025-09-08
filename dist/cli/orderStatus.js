#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mexcRest_1 = require("../infra/mexcRest");
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
async function checkOrderStatus() {
    try {
        console.log('🔍 ПРОВЕРКА СТАТУСА ОРДЕРОВ И БАЛАНСА');
        // Проверяем API ключи
        const apiKey = process.env.MEXC_API_KEY;
        const secretKey = process.env.MEXC_SECRET_KEY;
        if (!apiKey || !secretKey) {
            throw new Error('Не найдены API ключи MEXC в переменных окружения');
        }
        const mexcClient = new mexcRest_1.MexcRestClient(apiKey, secretKey);
        // 1. Проверяем текущую цену ETH
        console.log('\n💰 ТЕКУЩАЯ ЦЕНА ETH:');
        try {
            const currentPrice = await mexcClient.getPrice('ETH/USDC');
            console.log(`ETH/USDC: $${currentPrice.toFixed(4)}`);
        }
        catch (error) {
            console.log('❌ Не удалось получить цену ETH');
        }
        // 2. Проверяем баланс
        console.log('\n💳 БАЛАНС АККАУНТА:');
        try {
            const accountInfo = await mexcClient.getAccountInfo();
            const balances = accountInfo.balances.filter(b => b.free > 0 || b.locked > 0);
            balances.forEach(balance => {
                const total = balance.free + balance.locked;
                console.log(`${balance.asset}: ${total.toFixed(6)} (свободно: ${balance.free.toFixed(6)}, заблокировано: ${balance.locked.toFixed(6)})`);
            });
        }
        catch (error) {
            console.log('❌ Не удалось получить баланс');
        }
        // 3. Проверяем открытые ордера
        console.log('\n📋 ОТКРЫТЫЕ ОРДЕРА:');
        try {
            const openOrders = await mexcClient.getOpenOrders('ETH/USDC');
            const ethOrders = openOrders.filter(order => order.symbol === 'ETHUSDC');
            if (ethOrders.length === 0) {
                console.log('Нет открытых ордеров для ETHUSDC');
            }
            else {
                console.log(`Найдено ${ethOrders.length} открытых ордеров:`);
                ethOrders.forEach((order, index) => {
                    console.log(`${index + 1}. ${order.side.toUpperCase()} ${order.type} ${order.quantity} ETH @ $${order.price} (статус: ${order.status})`);
                });
            }
        }
        catch (error) {
            console.log('❌ Не удалось получить открытые ордера');
        }
        // 4. Проверяем историю ордеров за последние 24 часа
        console.log('\n📊 ИСТОРИЯ ОРДЕРОВ (24 часа):');
        try {
            // Используем существующий метод getMyTrades для получения сделок
            const trades = await mexcClient.getMyTrades('ETHUSDC', 1000);
            const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
            const recentTrades = trades.filter(trade => trade.timestamp >= oneDayAgo);
            if (recentTrades.length === 0) {
                console.log('Нет сделок за последние 24 часа');
            }
            else {
                console.log(`Найдено ${recentTrades.length} сделок за 24 часа:`);
                const buyTrades = recentTrades.filter(t => t.side === 'buy');
                const sellTrades = recentTrades.filter(t => t.side === 'sell');
                console.log(`Покупки: ${buyTrades.length}, Продажи: ${sellTrades.length}`);
                // Показываем последние 10 сделок
                recentTrades.slice(-10).forEach((trade, index) => {
                    const time = new Date(trade.timestamp).toLocaleString();
                    console.log(`${index + 1}. ${trade.side.toUpperCase()} ${trade.quantity} ETH @ $${trade.price} (${time})`);
                });
            }
        }
        catch (error) {
            console.log('❌ Не удалось получить историю сделок');
        }
        console.log('\n🎯 ДИАГНОСТИКА ЗАВЕРШЕНА');
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('\n❌ Ошибка:', errorMessage);
        process.exit(1);
    }
}
if (require.main === module) {
    checkOrderStatus();
}
//# sourceMappingURL=orderStatus.js.map