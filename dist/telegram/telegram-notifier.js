"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramNotifier = void 0;
const telegraf_1 = require("telegraf");
const mexc_spot_1 = require("../exchange/mexc-spot");
class TelegramNotifier {
    bot;
    chatIds;
    mexcClient;
    constructor(botToken, chatIds) {
        this.bot = new telegraf_1.Telegraf(botToken);
        this.chatIds = chatIds.split(',').map(id => id.trim());
        // Инициализируем MEXC клиент для получения баланса
        this.mexcClient = new mexc_spot_1.MexcSpotClient();
    }
    /**
     * Получить полную стоимость аккаунта в USDT
     */
    async getAccountValue() {
        try {
            const accountInfo = await this.mexcClient.getAccountInfo();
            let totalValueUSDT = 0;
            const balances = [];
            
            if (accountInfo.balances && Array.isArray(accountInfo.balances)) {
                // Получаем все цены для конвертации в USDT
                const pricesResponse = await this.mexcClient.getAllPrices();
                const prices = {};
                
                if (pricesResponse.data && Array.isArray(pricesResponse.data)) {
                    for (const price of pricesResponse.data) {
                        prices[price.symbol] = parseFloat(price.price);
                    }
                }
                
                for (const balance of accountInfo.balances) {
                    const free = parseFloat(balance.free || '0');
                    const locked = parseFloat(balance.locked || '0');
                    const total = free + locked;
                    
                    if (total > 0) {
                        const asset = balance.asset;
                        let valueUSDT = 0;
                        
                        if (asset === 'USDT') {
                            valueUSDT = total;
                        } else {
                            // Ищем пару с USDT для конвертации
                            const symbol = `${asset}USDT`;
                            if (prices[symbol]) {
                                valueUSDT = total * prices[symbol];
                            } else {
                                // Пробуем обратную пару
                                const reverseSymbol = `USDT${asset}`;
                                if (prices[reverseSymbol]) {
                                    valueUSDT = total / prices[reverseSymbol];
                                } else {
                                    // Если не найдена пара с USDT, оставляем как есть
                                    valueUSDT = total;
                                }
                            }
                        }
                        
                        totalValueUSDT += valueUSDT;
                        balances.push({
                            asset,
                            free: free.toFixed(6),
                            locked: locked.toFixed(6),
                            total: total.toFixed(6),
                            valueUSDT: valueUSDT.toFixed(2)
                        });
                    }
                }
            }
            
            return {
                totalValueUSDT: totalValueUSDT.toFixed(2),
                balances: balances.filter(b => parseFloat(b.total) > 0)
            };
        } catch (error) {
            console.error('Ошибка получения баланса аккаунта:', error);
            return {
                totalValueUSDT: '0.00',
                balances: []
            };
        }
    }
    /**
     * Отправить уведомление о запуске системы
     */
    async sendSystemStarted() {
        const message = `🚀 *СИСТЕМА ЗАПУЩЕНА*

📊 *Статус:* Анализ рынка активен
🎯 *Стратегия:* Поиск локальных минимумов
🤖 *LLM:* Включен
📱 *Telegram:* Включен

Система готова к работе!`;
        await this.sendToAllChats(message);
    }
    /**
     * Отправить анализ сделки
     */
    async sendTradeAnalysis(symbol, action, price, confidence, reasoning, patterns, marketConditions, recommendation) {
        const emoji = action === 'BUY' ? '🟢' : action === 'SELL' ? '🔴' : '🟡';
        const patternsText = patterns.length > 0 ? patterns.join(', ') : 'Не определены';
        const conditionsText = marketConditions.length > 0 ? marketConditions.join(', ') : 'Не определены';
        const message = `${emoji} *${action} СИГНАЛ - ${symbol}*

💰 *Цена:* $${price.toFixed(4)}
🎯 *Уверенность:* ${confidence}%
📊 *Паттерны:* ${patternsText}
🌍 *Условия рынка:* ${conditionsText}

🧠 *LLM АНАЛИЗ:*
${reasoning}

💡 *РЕКОМЕНДАЦИЯ:*
${recommendation}`;
        await this.sendToAllChats(message);
    }
    /**
     * Отправить отчет о рынке с полной стоимостью аккаунта
     */
    async sendMarketReport(totalTrades, winRate, profitFactor, bestPattern, currentTrend, recommendations) {
        // Получаем полную стоимость аккаунта
        const accountValue = await this.getAccountValue();
        
        const recommendationsText = recommendations.length > 0
            ? recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')
            : 'Нет рекомендаций';
        
        // Формируем информацию о балансе
        const balanceText = accountValue.balances.length > 0
            ? accountValue.balances.map(b => `${b.asset}: ${b.total} ($${b.valueUSDT})`).join('\n')
            : 'Нет активов';
        
        const message = `📊 *ОТЧЕТ О РЫНКЕ*

💰 *СОСТОЯНИЕ АККАУНТА:*
• Общая стоимость: $${accountValue.totalValueUSDT} USDT
• Активы:
${balanceText}

📈 *ТОРГОВАЯ СТАТИСТИКА:*
• Сделок: ${totalTrades}
• Винрейт: ${winRate.toFixed(1)}%
• Profit Factor: ${profitFactor.toFixed(2)}

🎯 *ПАТТЕРНЫ:*
• Лучший: ${bestPattern}
• Тренд: ${currentTrend}

💡 *РЕКОМЕНДАЦИИ:*
${recommendationsText}`;
        await this.sendToAllChats(message);
    }
    /**
     * Отправить LLM комментарий
     */
    async sendLLMCommentary(title, marketOverview, tradingOpportunities, riskAssessment, recommendations) {
        const opportunitiesText = tradingOpportunities.length > 0
            ? tradingOpportunities.map((opp, i) => `${i + 1}. ${opp}`).join('\n')
            : 'Нет возможностей';
        const recommendationsText = recommendations.length > 0
            ? recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')
            : 'Нет рекомендаций';
        const message = `🧠 *${title}*

🌍 *ОБЗОР РЫНКА:*
${marketOverview}

🎯 *ТОРГОВЫЕ ВОЗМОЖНОСТИ:*
${opportunitiesText}

⚠️ *ОЦЕНКА РИСКОВ:*
${riskAssessment}

💡 *РЕКОМЕНДАЦИИ:*
${recommendationsText}`;
        await this.sendToAllChats(message);
    }
    /**
     * Отправить ошибку
     */
    async sendError(title, message) {
        const errorMessage = `❌ *${title}*

${message}

🕐 *Время:* ${new Date().toLocaleString('ru-RU')}`;
        await this.sendToAllChats(errorMessage);
    }
    /**
     * Отправить тестовое сообщение
     */
    async sendTestMessage() {
        const message = `🧪 *ТЕСТОВОЕ СООБЩЕНИЕ*

✅ Telegram уведомления работают корректно
🕐 Время: ${new Date().toLocaleString('ru-RU')}`;
        await this.sendToAllChats(message);
    }
    /**
     * Отправить сообщение во все чаты
     */
    async sendToAllChats(message) {
        for (const chatId of this.chatIds) {
            try {
                await this.bot.telegram.sendMessage(chatId, message, {
                    parse_mode: 'Markdown',
                });
                console.log(`📱 Сообщение отправлено в чат ${chatId}`);
            }
            catch (error) {
                console.error(`❌ Ошибка отправки в чат ${chatId}:`, error);
            }
        }
    }
}
exports.TelegramNotifier = TelegramNotifier;
//# sourceMappingURL=telegram-notifier.js.map
