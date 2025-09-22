"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMAnalyzer = void 0;
const axios_1 = __importDefault(require("axios"));
class LLMAnalyzer {
    apiKey;
    baseUrl;
    maxRetries = 3;
    retryDelay = 2000;
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://foundation-models.api.cloud.ru/v1/chat/completions';
    }
    async analyzeTrade(trade, marketSnapshot, signal) {
        try {
            const prompt = this.buildTradeAnalysisPrompt(trade, marketSnapshot, signal);
            const response = await this.callLLMWithRetry(prompt);
            return this.parseTradeAnalysis(response);
        }
        catch (error) {
            console.error('Ошибка LLM анализа сделки:', error);
            return this.getDefaultTradeAnalysis();
        }
    }
    async analyzeResults(trades, snapshots, summary) {
        try {
            const prompt = this.buildResultsAnalysisPrompt(trades, snapshots, summary);
            const response = await this.callLLMWithRetry(prompt);
            return this.parseResultsAnalysis(response);
        }
        catch (error) {
            console.error('Ошибка LLM анализа результатов:', error);
            return this.getDefaultResultsAnalysis();
        }
    }
    async analyzeMarketSituation(marketSummary) {
        try {
            const prompt = this.buildMarketSituationPrompt(marketSummary);
            const response = await this.callLLMWithRetry(prompt);
            return this.parseMarketSituationAnalysis(response);
        }
        catch (error) {
            console.error('Ошибка LLM анализа рыночной ситуации:', error);
            return this.getDefaultMarketSituationAnalysis();
        }
    }
    async callLLMWithRetry(prompt) {
        let lastError = null;
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`🧠 LLM попытка ${attempt}/${this.maxRetries}...`);
                const response = await this.callLLM(prompt);
                console.log(`✅ LLM ответ получен на попытке ${attempt}`);
                return response;
            }
            catch (error) {
                lastError = error;
                console.error(`❌ LLM попытка ${attempt} неудачна:`, error);
                if (attempt < this.maxRetries) {
                    console.log(`⏳ Ожидание ${this.retryDelay}ms перед следующей попыткой...`);
                    await this.sleep(this.retryDelay);
                    this.retryDelay *= 1.5;
                }
            }
        }
        throw lastError || new Error('LLM API недоступен после всех попыток');
    }
    buildTradeAnalysisPrompt(trade, marketSnapshot, signal) {
        return `Ты - эксперт по криптотрейдингу. Проанализируй сделку:

СДЕЛКА: ${trade.symbol} ${trade.side} $${trade.entryPrice}
RSI: ${marketSnapshot.indicators.rsi}
Тренд: ${marketSnapshot.trend.direction}
Локальный минимум: ${marketSnapshot.trend.isLocalMinimum}

Дай краткий анализ в JSON:
{"action": "BUY/SELL/HOLD", "confidence": 0-100, "reasoning": "объяснение", "patterns": [], "marketConditions": [], "recommendation": "совет"}`;
    }
    buildResultsAnalysisPrompt(trades, snapshots, summary) {
        return `Ты - эксперт по криптотрейдингу. Проанализируй результаты:

СТАТИСТИКА: ${summary.totalTrades} сделок, винрейт ${summary.winRate}%

Дай анализ в JSON:
{"marketOverview": "обзор", "tradingOpportunities": [], "riskAssessment": "риски", "recommendations": []}`;
    }
    buildMarketSituationPrompt(marketSummary) {
        return `Ты - эксперт по криптотрейдингу. Проанализируй ситуацию:

БАЛАНС: $${marketSummary.balance}
СДЕЛКИ: ${marketSummary.totalTrades} (${marketSummary.winRate}% винрейт)

Дай анализ в JSON:
{"marketOverview": "обзор", "tradingOpportunities": [], "riskAssessment": "риски", "recommendations": []}`;
    }
    async callLLM(prompt) {
        const response = await axios_1.default.post(this.baseUrl, {
            model: 'openai/gpt-oss-120b',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 2000
        }, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
        return response.data.choices[0].message.content;
    }
    parseTradeAnalysis(response) {
        try {
            const parsed = this.extractJSON(response);
            if (parsed) {
                return {
                    action: parsed.action || 'HOLD',
                    confidence: parsed.confidence || 50,
                    reasoning: parsed.reasoning || 'Анализ недоступен',
                    patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
                    marketConditions: Array.isArray(parsed.marketConditions) ? parsed.marketConditions : [],
                    recommendation: parsed.recommendation || 'Нет рекомендаций'
                };
            }
        }
        catch (error) {
            console.error('Ошибка парсинга анализа сделки:', error);
        }
        return this.getDefaultTradeAnalysis();
    }
    parseResultsAnalysis(response) {
        try {
            const parsed = this.extractJSON(response);
            if (parsed) {
                return {
                    marketOverview: parsed.marketOverview || 'Анализ недоступен',
                    tradingOpportunities: Array.isArray(parsed.tradingOpportunities) ? parsed.tradingOpportunities : [],
                    riskAssessment: parsed.riskAssessment || 'Оценка недоступна',
                    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : []
                };
            }
        }
        catch (error) {
            console.error('Ошибка парсинга анализа результатов:', error);
        }
        return this.getDefaultResultsAnalysis();
    }
    parseMarketSituationAnalysis(response) {
        try {
            const parsed = this.extractJSON(response);
            if (parsed) {
                return {
                    marketOverview: parsed.marketOverview || 'Анализ недоступен',
                    tradingOpportunities: Array.isArray(parsed.tradingOpportunities) ? parsed.tradingOpportunities : [],
                    riskAssessment: parsed.riskAssessment || 'Оценка недоступна',
                    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : []
                };
            }
        }
        catch (error) {
            console.error('Ошибка парсинга анализа рыночной ситуации:', error);
        }
        return this.getDefaultMarketSituationAnalysis();
    }
    extractJSON(text) {
        try {
            // Ищем JSON блок
            const jsonStart = text.indexOf('{');
            if (jsonStart === -1)
                return null;
            let braceCount = 0;
            let jsonEnd = jsonStart;
            for (let i = jsonStart; i < text.length; i++) {
                if (text[i] === '{')
                    braceCount++;
                if (text[i] === '}')
                    braceCount--;
                if (braceCount === 0) {
                    jsonEnd = i;
                    break;
                }
            }
            const jsonStr = text.substring(jsonStart, jsonEnd + 1);
            console.log('🔍 Извлечен JSON:', jsonStr.substring(0, 100) + '...');
            // Очищаем от переносов строк в строках
            const cleanedJson = jsonStr.replace(/\n/g, ' ').replace(/\r/g, ' ');
            return JSON.parse(cleanedJson);
        }
        catch (error) {
            console.error('Ошибка извлечения JSON:', error);
            return null;
        }
    }
    getDefaultTradeAnalysis() {
        return {
            action: 'HOLD',
            confidence: 50,
            reasoning: 'LLM анализ недоступен',
            patterns: [],
            marketConditions: [],
            recommendation: 'Ожидать лучших условий'
        };
    }
    getDefaultResultsAnalysis() {
        return {
            marketOverview: 'LLM анализ недоступен',
            tradingOpportunities: [],
            riskAssessment: 'Оценка недоступна',
            recommendations: []
        };
    }
    getDefaultMarketSituationAnalysis() {
        return {
            marketOverview: 'LLM анализ недоступен',
            tradingOpportunities: [],
            riskAssessment: 'Оценка недоступна',
            recommendations: []
        };
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.LLMAnalyzer = LLMAnalyzer;
//# sourceMappingURL=llm-analyzer.js.map