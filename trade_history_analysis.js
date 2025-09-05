#!/usr/bin/env node
require('dotenv').config();

const { MexcRestClient } = require('./dist/infra/mexcRest');

console.log('📊 АНАЛИЗ ТОРГОВОЙ ИСТОРИИ - РАСЧЕТ PnL');
console.log('════════════════════════════════════════════════════════════════');

const client = new MexcRestClient(process.env.MEXC_API_KEY, process.env.MEXC_SECRET_KEY);

async function analyzeTradeHistory() {
    try {
        console.log('📈 Получение торговой истории...');
        
        // Получаем все сделки за последние 24 часа
        const trades = await client.getMyTrades('ETHUSDC', 1000);
        
        if (!trades || trades.length === 0) {
            console.log('❌ Сделки не найдены');
            return;
        }
        
        console.log(`✅ Найдено ${trades.length} сделок`);
        
        // Фильтруем сделки за последние 30 минут
        const now = Date.now();
        const thirtyMinutesAgo = now - (30 * 60 * 1000);
        
        const recentTrades = trades.filter(trade => {
            return trade.timestamp > thirtyMinutesAgo;
        });
        
        console.log(`📅 Сделки за последние 30 минут: ${recentTrades.length}`);
        
        if (recentTrades.length === 0) {
            console.log('❌ Нет сделок за последние 30 минут');
            return;
        }
        
        // Сортируем по времени
        recentTrades.sort((a, b) => a.timestamp - b.timestamp);
        
        // Показываем временной диапазон
        const firstTrade = recentTrades[0];
        const lastTrade = recentTrades[recentTrades.length - 1];
        console.log(`⏰ Период: ${new Date(firstTrade.timestamp).toLocaleString()} - ${new Date(lastTrade.timestamp).toLocaleString()}`);
        
        // Анализируем PnL
        let totalPnL = 0;
        let totalFees = 0;
        let totalVolume = 0;
        let buyTrades = [];
        let sellTrades = [];
        let tradePairs = [];
        
        // Разделяем на покупки и продажи
        recentTrades.forEach(trade => {
            if (trade.side === 'buy') {
                buyTrades.push(trade);
            } else {
                sellTrades.push(trade);
            }
        });
        
        console.log(`\n📊 СТАТИСТИКА СДЕЛОК:`);
        console.log(`🟢 Покупки: ${buyTrades.length}`);
        console.log(`🔴 Продажи: ${sellTrades.length}`);
        
        // Анализируем пары сделок
        let i = 0, j = 0;
        let inventory = 0;
        let totalCost = 0;
        let totalRevenue = 0;
        let pairCount = 0;
        
        console.log(`\n💰 АНАЛИЗ PnL ПО ПАРАМ:`);
        console.log('════════════════════════════════════════════════════════════════');
        
        while (i < buyTrades.length && j < sellTrades.length) {
            const buyTrade = buyTrades[i];
            const sellTrade = sellTrades[j];
            
            const buyTime = new Date(buyTrade.timestamp);
            const sellTime = new Date(sellTrade.timestamp);
            
            // Если покупка раньше продажи
            if (buyTime < sellTime) {
                const buyAmount = parseFloat(buyTrade.quantity);
                const buyPrice = parseFloat(buyTrade.price);
                const buyCost = buyAmount * buyPrice;
                const buyFee = parseFloat(buyTrade.fee) || 0;
                
                inventory += buyAmount;
                totalCost += buyCost + buyFee;
                totalFees += buyFee;
                totalVolume += buyCost;
                
                console.log(`🟢 ПОКУПКА: ${buyAmount.toFixed(6)} ETH @ ${buyPrice.toFixed(2)} USDC`);
                console.log(`   💰 Стоимость: ${buyCost.toFixed(4)} USDC + комиссия: ${buyFee.toFixed(4)} USDC`);
                console.log(`   ⏰ Время: ${buyTime.toLocaleString()}`);
                console.log(`   📊 Инвентарь: ${inventory.toFixed(6)} ETH`);
                
                i++;
            } else {
                const sellAmount = parseFloat(sellTrade.quantity);
                const sellPrice = parseFloat(sellTrade.price);
                const sellRevenue = sellAmount * sellPrice;
                const sellFee = parseFloat(sellTrade.fee) || 0;
                
                if (inventory >= sellAmount) {
                    inventory -= sellAmount;
                    totalRevenue += sellRevenue - sellFee;
                    totalFees += sellFee;
                    totalVolume += sellRevenue;
                    
                    // Рассчитываем PnL для этой пары
                    const avgBuyPrice = totalCost / (totalCost / (totalCost - (inventory * (totalCost / (inventory + sellAmount)))));
                    const tradePnL = sellRevenue - (sellAmount * avgBuyPrice) - sellFee;
                    totalPnL += tradePnL;
                    pairCount++;
                    
                    console.log(`🔴 ПРОДАЖА: ${sellAmount.toFixed(6)} ETH @ ${sellPrice.toFixed(2)} USDC`);
                    console.log(`   💰 Выручка: ${sellRevenue.toFixed(4)} USDC - комиссия: ${sellFee.toFixed(4)} USDC`);
                    console.log(`   ⏰ Время: ${sellTime.toLocaleString()}`);
                    console.log(`   📊 Инвентарь: ${inventory.toFixed(6)} ETH`);
                    console.log(`   💵 PnL: ${tradePnL.toFixed(4)} USDC`);
                    console.log('   ────────────────────────────────────────────────────────────────');
                } else {
                    console.log(`⚠️  Недостаточно инвентаря для продажи: ${sellAmount.toFixed(6)} ETH (есть: ${inventory.toFixed(6)} ETH)`);
                }
                
                j++;
            }
        }
        
        // Обрабатываем оставшиеся сделки
        while (i < buyTrades.length) {
            const buyTrade = buyTrades[i];
            const buyAmount = parseFloat(buyTrade.quantity);
            const buyPrice = parseFloat(buyTrade.price);
            const buyCost = buyAmount * buyPrice;
            const buyFee = parseFloat(buyTrade.fee) || 0;
            
            inventory += buyAmount;
            totalCost += buyCost + buyFee;
            totalFees += buyFee;
            totalVolume += buyCost;
            
            console.log(`🟢 ПОКУПКА: ${buyAmount.toFixed(6)} ETH @ ${buyPrice.toFixed(2)} USDC`);
            console.log(`   💰 Стоимость: ${buyCost.toFixed(4)} USDC + комиссия: ${buyFee.toFixed(4)} USDC`);
            console.log(`   📊 Инвентарь: ${inventory.toFixed(6)} ETH`);
            
            i++;
        }
        
        while (j < sellTrades.length) {
            const sellTrade = sellTrades[j];
            const sellAmount = parseFloat(sellTrade.quantity);
            const sellPrice = parseFloat(sellTrade.price);
            const sellRevenue = sellAmount * sellPrice;
            const sellFee = parseFloat(sellTrade.fee) || 0;
            
            if (inventory >= sellAmount) {
                inventory -= sellAmount;
                totalRevenue += sellRevenue - sellFee;
                totalFees += sellFee;
                totalVolume += sellRevenue;
                
                console.log(`🔴 ПРОДАЖА: ${sellAmount.toFixed(6)} ETH @ ${sellPrice.toFixed(2)} USDC`);
                console.log(`   💰 Выручка: ${sellRevenue.toFixed(4)} USDC - комиссия: ${sellFee.toFixed(4)} USDC`);
                console.log(`   📊 Инвентарь: ${inventory.toFixed(6)} ETH`);
            } else {
                console.log(`⚠️  Недостаточно инвентаря для продажи: ${sellAmount.toFixed(6)} ETH (есть: ${inventory.toFixed(6)} ETH)`);
            }
            
            j++;
        }
        
        // Итоговая статистика
        console.log(`\n📈 ИТОГОВАЯ СТАТИСТИКА:`);
        console.log('════════════════════════════════════════════════════════════════');
        console.log(`💰 Общая выручка: ${totalRevenue.toFixed(4)} USDC`);
        console.log(`💸 Общие затраты: ${totalCost.toFixed(4)} USDC`);
        console.log(`📊 Комиссии: ${totalFees.toFixed(4)} USDC`);
        console.log(`💵 PnL: ${totalPnL.toFixed(4)} USDC`);
        console.log(`📈 Инвентарь: ${inventory.toFixed(6)} ETH`);
        console.log(`🔄 Пар сделок: ${pairCount}`);
        
        if (inventory > 0) {
            const currentPrice = 4350; // Примерная текущая цена
            const inventoryValue = inventory * currentPrice;
            console.log(`💎 Стоимость инвентаря: ${inventoryValue.toFixed(4)} USDC`);
        }
        
        // Анализ эффективности
        const feeRate = totalVolume > 0 ? (totalFees / totalVolume) * 100 : 0;
        const pnlRate = totalVolume > 0 ? (totalPnL / totalVolume) * 100 : 0;
        
        console.log(`\n📊 ЭФФЕКТИВНОСТЬ:`);
        console.log('════════════════════════════════════════════════════════════════');
        console.log(`📈 Объем торгов: ${totalVolume.toFixed(4)} USDC`);
        console.log(`💸 Комиссии: ${feeRate.toFixed(3)}% от объема`);
        console.log(`💵 PnL: ${pnlRate.toFixed(3)}% от объема`);
        console.log(`🎯 Чистая прибыль: ${(pnlRate - feeRate).toFixed(3)}% от объема`);
        
        // Анализ по времени
        const timeDiff = lastTrade.timestamp - firstTrade.timestamp;
        const minutes = timeDiff / (1000 * 60);
        const tradesPerMinute = recentTrades.length / minutes;
        
        console.log(`\n⏰ ВРЕМЕННОЙ АНАЛИЗ:`);
        console.log('════════════════════════════════════════════════════════════════');
        console.log(`⏱️  Период: ${minutes.toFixed(2)} минут`);
        console.log(`🔄 Сделок в минуту: ${tradesPerMinute.toFixed(1)}`);
        console.log(`💰 PnL в минуту: ${(totalPnL / minutes).toFixed(4)} USDC`);
        console.log(`📈 Объем в минуту: ${(totalVolume / minutes).toFixed(4)} USDC`);
        
        // Итоговый вердикт
        console.log(`\n🎯 ИТОГОВЫЙ ВЕРДИКТ:`);
        console.log('════════════════════════════════════════════════════════════════');
        if (totalPnL > 0) {
            console.log(`✅ СКАЛЬПЕР ТОРГУЕТ В ПЛЮС! +${totalPnL.toFixed(4)} USDC`);
        } else if (totalPnL < 0) {
            console.log(`❌ СКАЛЬПЕР ТОРГУЕТ В МИНУС! ${totalPnL.toFixed(4)} USDC`);
        } else {
            console.log(`⚖️ СКАЛЬПЕР ТОРГУЕТ В НОЛЬ: ${totalPnL.toFixed(4)} USDC`);
        }
        
        console.log(`📊 Эффективность: ${pnlRate.toFixed(3)}% от объема`);
        console.log(`🔄 Активность: ${tradesPerMinute.toFixed(1)} сделок/мин`);
        
    } catch (error) {
        console.error('❌ Ошибка анализа торговой истории:', error.message);
    }
}

// Запускаем анализ
analyzeTradeHistory().then(() => {
    console.log('\n✅ Анализ завершен');
    process.exit(0);
}).catch(error => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
});


