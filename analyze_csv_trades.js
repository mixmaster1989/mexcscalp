#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('📊 АНАЛИЗ ТОРГОВОЙ ИСТОРИИ ИЗ CSV');
console.log('════════════════════════════════════════════════════════════════');

// Читаем CSV файл
const csvPath = path.join(__dirname, 'data', 'daily_trades.csv');

if (!fs.existsSync(csvPath)) {
    console.log('❌ CSV файл не найден:', csvPath);
    process.exit(1);
}

try {
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n');
    
    // Пропускаем заголовок
    const dataLines = lines.slice(1).filter(line => line.trim());
    
    console.log(`✅ Загружено ${dataLines.length} сделок из CSV`);
    
    // Парсим данные
    const trades = dataLines.map(line => {
        const [id, symbol, side, entryPrice, exitPrice, quantity, pnl, fee, timestamp, strategy, orderId] = 
            line.split(',').map(field => field.replace(/"/g, ''));
        
        return {
            id,
            symbol,
            side,
            entryPrice: parseFloat(entryPrice),
            exitPrice: parseFloat(exitPrice),
            quantity: parseFloat(quantity),
            pnl: parseFloat(pnl),
            fee: parseFloat(fee),
            timestamp: new Date(timestamp),
            strategy,
            orderId
        };
    });
    
    // Фильтруем сделки за последние 30 минут
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - (30 * 60 * 1000));
    
    const recentTrades = trades.filter(trade => trade.timestamp > thirtyMinutesAgo);
    
    console.log(`📅 Сделки за последние 30 минут: ${recentTrades.length}`);
    
    if (recentTrades.length === 0) {
        console.log('❌ Нет сделок за последние 30 минут');
        
        // Показываем последние 10 сделок
        console.log('\n📋 ПОСЛЕДНИЕ 10 СДЕЛОК:');
        console.log('════════════════════════════════════════════════════════════════');
        
        const lastTrades = trades.slice(-10);
        lastTrades.forEach(trade => {
            const pnlColor = trade.pnl > 0 ? '🟢' : trade.pnl < 0 ? '🔴' : '⚪';
            console.log(`${pnlColor} ${trade.side.toUpperCase()} ${trade.entryPrice} → ${trade.exitPrice} | PnL: ${trade.pnl.toFixed(4)} | ${trade.timestamp.toLocaleString()}`);
        });
        
        return;
    }
    
    // Показываем временной диапазон
    const firstTrade = recentTrades[0];
    const lastTrade = recentTrades[recentTrades.length - 1];
    console.log(`⏰ Период: ${firstTrade.timestamp.toLocaleString()} - ${lastTrade.timestamp.toLocaleString()}`);
    
    // Анализируем PnL
    let totalPnL = 0;
    let totalFees = 0;
    let totalVolume = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let buyTrades = 0;
    let sellTrades = 0;
    
    console.log(`\n💰 АНАЛИЗ PnL ПО СДЕЛКАМ:`);
    console.log('════════════════════════════════════════════════════════════════');
    
    recentTrades.forEach(trade => {
        totalPnL += trade.pnl;
        totalFees += trade.fee;
        totalVolume += trade.entryPrice * trade.quantity;
        
        if (trade.side === 'buy') buyTrades++;
        else sellTrades++;
        
        if (trade.pnl > 0) winningTrades++;
        else if (trade.pnl < 0) losingTrades++;
        
        const pnlColor = trade.pnl > 0 ? '🟢' : trade.pnl < 0 ? '🔴' : '⚪';
        console.log(`${pnlColor} ${trade.side.toUpperCase()}: ${trade.entryPrice} → ${trade.exitPrice} | PnL: ${trade.pnl.toFixed(4)} | ${trade.timestamp.toLocaleString()}`);
    });
    
    // Итоговая статистика
    console.log(`\n📈 ИТОГОВАЯ СТАТИСТИКА:`);
    console.log('════════════════════════════════════════════════════════════════');
    console.log(`💰 Общий PnL: ${totalPnL.toFixed(4)} USDC`);
    console.log(`💸 Комиссии: ${totalFees.toFixed(4)} USDC`);
    console.log(`📊 Объем торгов: ${totalVolume.toFixed(4)} USDC`);
    console.log(`🟢 Покупки: ${buyTrades}`);
    console.log(`🔴 Продажи: ${sellTrades}`);
    console.log(`✅ Прибыльные: ${winningTrades}`);
    console.log(`❌ Убыточные: ${losingTrades}`);
    
    // Анализ эффективности
    const feeRate = totalVolume > 0 ? (totalFees / totalVolume) * 100 : 0;
    const pnlRate = totalVolume > 0 ? (totalPnL / totalVolume) * 100 : 0;
    const winRate = recentTrades.length > 0 ? (winningTrades / recentTrades.length) * 100 : 0;
    
    console.log(`\n📊 ЭФФЕКТИВНОСТЬ:`);
    console.log('════════════════════════════════════════════════════════════════');
    console.log(`💸 Комиссии: ${feeRate.toFixed(3)}% от объема`);
    console.log(`💵 PnL: ${pnlRate.toFixed(3)}% от объема`);
    console.log(`🎯 Чистая прибыль: ${(pnlRate - feeRate).toFixed(3)}% от объема`);
    console.log(`📈 Винрейт: ${winRate.toFixed(1)}%`);
    
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
    console.log(`📈 Винрейт: ${winRate.toFixed(1)}%`);
    
} catch (error) {
    console.error('❌ Ошибка анализа CSV:', error.message);
}


