#!/usr/bin/env node

require('dotenv').config();
const { MexcRestClient } = require('./dist/infra/mexcRest');

console.log('⏰ АНАЛИЗ ТОРГОВЛИ ЗА ПОСЛЕДНИЙ ЧАС');
console.log('════════════════════════════════════════════════════════════════');

const client = new MexcRestClient(process.env.MEXC_API_KEY, process.env.MEXC_SECRET_KEY);

async function analyzeLast30Minutes() {
    try {
        // Получаем текущее время
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
        
        console.log(`🕐 Анализируем период: ${oneHourAgo.toLocaleString('ru-RU')} - ${now.toLocaleString('ru-RU')}`);
        
        // Получаем последние сделки
        console.log('\n📡 Получение сделок с API...');
        const trades = await client.getMyTrades('ETHUSDC', 100);
        
        if (trades.length === 0) {
            console.log('❌ Нет сделок в истории');
            return;
        }
        
        // Фильтруем сделки за последний час
        const recentTrades = trades.filter(trade => {
            const tradeTime = new Date(trade.timestamp);
            return tradeTime > oneHourAgo;
        });
        
        console.log(`📊 Найдено сделок за последний час: ${recentTrades.length}`);
        
        if (recentTrades.length === 0) {
            console.log('❌ Нет сделок за последний час');
            
            // Показываем последние 5 сделок для контекста
            console.log('\n📋 ПОСЛЕДНИЕ 5 СДЕЛОК:');
            console.log('════════════════════════════════════════════════════════════════');
            const lastTrades = trades.slice(0, 5);
            lastTrades.forEach((trade, index) => {
                const time = new Date(trade.timestamp).toLocaleString('ru-RU');
                console.log(`${index + 1}. ${trade.side.toUpperCase()} ${trade.price} x ${trade.quantity} | ${time}`);
            });
            return;
        }
        
        // Сортируем по времени
        recentTrades.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Показываем все сделки за последний час
        console.log('\n📋 СДЕЛКИ ЗА ПОСЛЕДНИЙ ЧАС:');
        console.log('════════════════════════════════════════════════════════════════');
        
        let totalVolume = 0;
        let buyTrades = 0;
        let sellTrades = 0;
        let totalNotional = 0;
        
        recentTrades.forEach((trade, index) => {
            const time = new Date(trade.timestamp).toLocaleString('ru-RU');
            const notional = trade.price * trade.quantity;
            totalNotional += notional;
            totalVolume += trade.quantity;
            
            if (trade.side === 'buy') buyTrades++;
            else sellTrades++;
            
            const sideIcon = trade.side === 'buy' ? '🟢' : '🔴';
            console.log(`${index + 1}. ${sideIcon} ${trade.side.toUpperCase()} ${trade.price} x ${trade.quantity} | ${notional.toFixed(4)} USDC | ${time}`);
        });
        
        // Анализ активности
        const firstTrade = recentTrades[0];
        const lastTrade = recentTrades[recentTrades.length - 1];
        const timeDiff = new Date(lastTrade.timestamp) - new Date(firstTrade.timestamp);
        const minutes = timeDiff / (1000 * 60);
        
        console.log('\n📊 СТАТИСТИКА ЗА ПОСЛЕДНИЙ ЧАС:');
        console.log('════════════════════════════════════════════════════════════════');
        console.log(`🟢 Покупки: ${buyTrades}`);
        console.log(`🔴 Продажи: ${sellTrades}`);
        console.log(`📊 Общий объем: ${totalVolume.toFixed(6)} ETH`);
        console.log(`💰 Общий оборот: ${totalNotional.toFixed(4)} USDC`);
        console.log(`⏱️  Период торговли: ${minutes.toFixed(1)} минут`);
        console.log(`🔄 Сделок в минуту: ${(recentTrades.length / Math.max(minutes, 1)).toFixed(1)}`);
        console.log(`📈 Объем в минуту: ${(totalVolume / Math.max(minutes, 1)).toFixed(6)} ETH`);
        console.log(`💰 Оборот в минуту: ${(totalNotional / Math.max(minutes, 1)).toFixed(4)} USDC`);
        
        // Анализ ценового диапазона
        const prices = recentTrades.map(t => t.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice;
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        
        console.log('\n💹 АНАЛИЗ ЦЕН:');
        console.log('════════════════════════════════════════════════════════════════');
        console.log(`📉 Минимальная цена: ${minPrice.toFixed(4)} USDC`);
        console.log(`📈 Максимальная цена: ${maxPrice.toFixed(4)} USDC`);
        console.log(`📊 Средняя цена: ${avgPrice.toFixed(4)} USDC`);
        console.log(`📏 Ценовой диапазон: ${priceRange.toFixed(4)} USDC`);
        console.log(`📊 Волатильность: ${(priceRange / avgPrice * 100).toFixed(3)}%`);
        
        // Анализ баланса покупок/продаж
        const buyVolume = recentTrades.filter(t => t.side === 'buy').reduce((sum, t) => sum + t.quantity, 0);
        const sellVolume = recentTrades.filter(t => t.side === 'sell').reduce((sum, t) => sum + t.quantity, 0);
        const netPosition = buyVolume - sellVolume;
        
        console.log('\n⚖️ АНАЛИЗ ПОЗИЦИИ:');
        console.log('════════════════════════════════════════════════════════════════');
        console.log(`🟢 Объем покупок: ${buyVolume.toFixed(6)} ETH`);
        console.log(`🔴 Объем продаж: ${sellVolume.toFixed(6)} ETH`);
        console.log(`📊 Чистая позиция: ${netPosition.toFixed(6)} ETH`);
        console.log(`📈 Направление: ${netPosition > 0 ? 'Накопление' : netPosition < 0 ? 'Распродажа' : 'Нейтрально'}`);
        
        // Итоговый вердикт
        console.log('\n🎯 ИТОГОВЫЙ ВЕРДИКТ:');
        console.log('════════════════════════════════════════════════════════════════');
        if (recentTrades.length > 0) {
            console.log(`✅ СКАЛЬПЕР АКТИВНО ТОРГУЕТ!`);
            console.log(`🔄 ${recentTrades.length} сделок за ${minutes.toFixed(1)} минут`);
            console.log(`📊 Интенсивность: ${(recentTrades.length / Math.max(minutes, 1)).toFixed(1)} сделок/мин`);
            console.log(`💰 Оборот: ${totalNotional.toFixed(4)} USDC`);
        } else {
            console.log(`⏸️ СКАЛЬПЕР НЕ ТОРГУЕТ в последние 30 минут`);
        }
        
    } catch (error) {
        console.error('❌ Ошибка анализа:', error.message);
    }
}

// Запускаем анализ
analyzeLast30Minutes();
