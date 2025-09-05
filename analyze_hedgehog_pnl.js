#!/usr/bin/env node
require('dotenv').config();

const { MexcRestClient } = require('./dist/infra/mexcRest');
const fs = require('fs');
const path = require('path');

// Загружаем конфигурацию
const configPath = path.join(__dirname, 'scalper_config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Создаем клиент
const client = new MexcRestClient(process.env.MEXC_API_KEY, process.env.MEXC_SECRET_KEY);

async function analyzeHedgehogPnL() {
    console.log('🦔 АНАЛИЗ PnL ЁРШИКОВЫХ СДЕЛОК');
    console.log('════════════════════════════════════════════════════════════════');
    
    try {
        // Получаем последние сделки
        console.log('📊 Получение сделок через API...');
        const trades = await client.getMyTrades('ETHUSDC', 100);
        
        if (!trades || trades.length === 0) {
            console.log('❌ Сделки не найдены');
            return;
        }
        
        console.log(`✅ Найдено ${trades.length} сделок`);
        
        // Показываем временные метки первых и последних сделок
        if (trades.length > 0) {
            const firstTrade = trades[trades.length - 1];
            const lastTrade = trades[0];
            console.log(`📅 Первая сделка: ${new Date(firstTrade.timestamp).toLocaleString()}`);
            console.log(`📅 Последняя сделка: ${new Date(lastTrade.timestamp).toLocaleString()}`);
        }
        
        // Фильтруем сделки за последние 6 часов (расширяем период)
        const now = Date.now();
        const sixHoursAgo = now - (6 * 60 * 60 * 1000);
        
        const recentTrades = trades.filter(trade => {
            return trade.timestamp > sixHoursAgo;
        });
        
        console.log(`📅 Сделки за последние 6 часов: ${recentTrades.length}`);
        
        if (recentTrades.length === 0) {
            console.log('❌ Нет сделок за последние 6 часов');
            return;
        }
        
        // Анализируем PnL
        let totalPnL = 0;
        let totalFees = 0;
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
        
        // Сортируем по времени
        buyTrades.sort((a, b) => a.timestamp - b.timestamp);
        sellTrades.sort((a, b) => a.timestamp - b.timestamp);
        
        // Анализируем пары сделок (покупка -> продажа)
        let i = 0, j = 0;
        let inventory = 0;
        let totalCost = 0;
        let totalRevenue = 0;
        
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
                    
                    // Рассчитываем PnL для этой части
                    const avgBuyPrice = totalCost / (totalCost / (totalCost - (inventory * (totalCost / (inventory + sellAmount)))));
                    const tradePnL = sellRevenue - (sellAmount * avgBuyPrice) - sellFee;
                    totalPnL += tradePnL;
                    
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
        
        if (inventory > 0) {
            const currentPrice = 4330; // Примерная текущая цена
            const inventoryValue = inventory * currentPrice;
            console.log(`💎 Стоимость инвентаря: ${inventoryValue.toFixed(4)} USDC`);
        }
        
        // Анализ эффективности
        const totalVolume = totalCost + totalRevenue;
        const feeRate = (totalFees / totalVolume) * 100;
        const pnlRate = (totalPnL / totalVolume) * 100;
        
        console.log(`\n📊 ЭФФЕКТИВНОСТЬ:`);
        console.log('════════════════════════════════════════════════════════════════');
        console.log(`📈 Объем торгов: ${totalVolume.toFixed(4)} USDC`);
        console.log(`💸 Комиссии: ${feeRate.toFixed(3)}% от объема`);
        console.log(`💵 PnL: ${pnlRate.toFixed(3)}% от объема`);
        console.log(`🎯 Чистая прибыль: ${(pnlRate - feeRate).toFixed(3)}% от объема`);
        
        // Анализ по времени
        if (recentTrades.length > 0) {
            const firstTrade = recentTrades[recentTrades.length - 1];
            const lastTrade = recentTrades[0];
            const timeDiff = lastTrade.timestamp - firstTrade.timestamp;
            const hours = timeDiff / (1000 * 60 * 60);
            const tradesPerHour = recentTrades.length / hours;
            
            console.log(`\n⏰ ВРЕМЕННОЙ АНАЛИЗ:`);
            console.log('════════════════════════════════════════════════════════════════');
            console.log(`⏱️  Период: ${hours.toFixed(2)} часов`);
            console.log(`🔄 Сделок в час: ${tradesPerHour.toFixed(1)}`);
            console.log(`💰 PnL в час: ${(totalPnL / hours).toFixed(4)} USDC`);
        }
        
    } catch (error) {
        console.error('❌ Ошибка анализа PnL:', error.message);
    }
}

// Запускаем анализ
analyzeHedgehogPnL().then(() => {
    console.log('\n✅ Анализ завершен');
    process.exit(0);
}).catch(error => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
});
