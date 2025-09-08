#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const tradeHistory_1 = require("../metrics/tradeHistory");
const db_1 = require("../storage/db");
// Загружаем переменные окружения
(0, dotenv_1.config)();
async function main() {
    try {
        console.log('🚀 Запуск получения истории сделок за сутки...\n');
        // Проверяем наличие API ключей
        const apiKey = process.env.MEXC_API_KEY;
        const secretKey = process.env.MEXC_SECRET_KEY;
        if (!apiKey || !secretKey) {
            throw new Error('Не найдены API ключи MEXC. Проверьте файл .env');
        }
        // Инициализируем базу данных
        console.log('📊 Подключение к базе данных...');
        await (0, db_1.initDatabase)();
        console.log('✅ База данных подключена\n');
        // Создаем сервис истории сделок
        const tradeHistoryService = new tradeHistory_1.TradeHistoryService(apiKey, secretKey);
        // Проверяем подключение к MEXC API
        console.log('🔌 Проверка подключения к MEXC API...');
        try {
            const isConnected = await tradeHistoryService['mexcClient'].ping();
            if (isConnected) {
                console.log('✅ Подключение к MEXC API успешно');
            }
            else {
                console.log('❌ Не удалось подключиться к MEXC API');
            }
        }
        catch (error) {
            console.log('❌ Ошибка подключения к MEXC API:', error);
        }
        // Тестовый вызов API для получения сделок
        console.log('\n🧪 Тестовый вызов MEXC API...');
        try {
            const testTrades = await tradeHistoryService['mexcClient'].getMyTrades('ETHUSDC', 10);
            console.log(`✅ API вернул ${testTrades.length} сделок`);
            if (testTrades.length > 0) {
                console.log('📋 Пример сделки:', {
                    id: testTrades[0].id,
                    symbol: testTrades[0].symbol,
                    side: testTrades[0].side,
                    price: testTrades[0].price,
                    quantity: testTrades[0].quantity,
                    timestamp: new Date(testTrades[0].timestamp).toLocaleString('ru-RU')
                });
            }
        }
        catch (error) {
            console.log('❌ Ошибка тестового вызова API:', error);
        }
        // Получаем историю сделок за сутки
        console.log('\n📈 Получение истории сделок за последние 24 часа...');
        const trades = await tradeHistoryService.getDailyTradeHistory();
        if (trades.length === 0) {
            console.log('ℹ️  За последние 24 часа сделок не найдено');
            return;
        }
        console.log(`✅ Найдено ${trades.length} сделок\n`);
        // Получаем статистику
        console.log('📊 Расчет статистики...');
        const stats = await tradeHistoryService.getDailyTradeStats();
        // Выводим статистику
        console.log('\n📊 СТАТИСТИКА ЗА СУТКИ:');
        console.log('═'.repeat(50));
        console.log(`Всего сделок: ${stats.totalTrades}`);
        console.log(`Прибыльных: ${stats.winningTrades}`);
        console.log(`Убыточных: ${stats.losingTrades}`);
        console.log(`Винрейт: ${stats.winRate.toFixed(2)}%`);
        console.log(`Общий PnL: ${stats.totalPnl.toFixed(4)} USDC`);
        console.log(`Средний PnL: ${stats.avgPnl.toFixed(4)} USDC`);
        console.log(`Общие комиссии: ${stats.totalFees.toFixed(4)} USDC`);
        console.log(`Лучшая сделка: ${stats.bestTrade.toFixed(4)} USDC`);
        console.log(`Худшая сделка: ${stats.worstTrade.toFixed(4)} USDC`);
        // Выводим топ сделки
        if (stats.winningTrades > 0) {
            console.log('\n🏆 ТОП-5 ЛУЧШИХ СДЕЛОК:');
            console.log('═'.repeat(50));
            const topTrades = await tradeHistoryService.getTopTrades(5);
            topTrades.forEach((trade, index) => {
                const time = new Date(trade.timestamp).toLocaleTimeString('ru-RU');
                console.log(`${index + 1}. ${trade.symbol} | ${trade.side.toUpperCase()} | PnL: ${trade.pnl.toFixed(4)} | ${time}`);
            });
        }
        // Выводим худшие сделки
        if (stats.losingTrades > 0) {
            console.log('\n💸 ТОП-5 ХУДШИХ СДЕЛОК:');
            console.log('═'.repeat(50));
            const worstTrades = await tradeHistoryService.getWorstTrades(5);
            worstTrades.forEach((trade, index) => {
                const time = new Date(trade.timestamp).toLocaleTimeString('ru-RU');
                console.log(`${index + 1}. ${trade.symbol} | ${trade.side.toUpperCase()} | PnL: ${trade.pnl.toFixed(4)} | ${time}`);
            });
        }
        // Выводим детальную историю
        console.log('\n📋 ПОЛНАЯ ИСТОРИЯ СДЕЛОК:');
        console.log('═'.repeat(120));
        console.log('№\tID\t\tСимвол\tСторона\tВход\tВыход\tКол-во\tPnL (USDC)\tВремя\t\t\tСтратегия');
        console.log('─'.repeat(120));
        // Показываем ВСЕ сделки, а не только первые 20
        trades.forEach((trade, index) => {
            const time = new Date(trade.timestamp).toLocaleString('ru-RU');
            const side = trade.side === 'buy' ? 'BUY ' : 'SELL';
            const strategy = trade.strategy || 'N/A';
            const pnlColor = trade.pnl >= 0 ? '🟢' : '🔴';
            console.log(`${index + 1}\t` +
                `${trade.tradeId.slice(0, 8)}...\t` +
                `${trade.symbol}\t` +
                `${side}\t` +
                `${trade.entryPrice.toFixed(4)}\t` +
                `${trade.exitPrice.toFixed(4)}\t` +
                `${trade.quantity.toFixed(6)}\t` +
                `${pnlColor} ${trade.pnl.toFixed(4)}\t` +
                `${time}\t` +
                `${strategy}`);
        });
        console.log(`\n📊 Всего показано: ${trades.length} сделок`);
        // Экспорт в CSV
        console.log('\n💾 Экспорт в CSV...');
        const csvContent = await tradeHistoryService.exportToCSV(trades);
        const fs = require('fs');
        const path = require('path');
        const csvPath = path.join(__dirname, '../../data/daily_trades.csv');
        // Создаем директорию если не существует
        const dir = path.dirname(csvPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(csvPath, csvContent);
        console.log(`✅ CSV файл сохранен: ${csvPath}`);
        console.log('\n🎉 Анализ истории сделок завершен!');
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('\n❌ Ошибка:', errorMessage);
        process.exit(1);
    }
}
// Запускаем основную функцию
if (require.main === module) {
    main();
}
//# sourceMappingURL=tradeHistory.js.map