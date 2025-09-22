"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.example = example;
require("dotenv/config");
const test_analyzer_1 = require("./market-analysis/test-analyzer");
/**
 * Пример использования
 */
async function example() {
    console.log('🚀 Пример запущен');
    // Запускаем тест анализатора
    await (0, test_analyzer_1.testAnalyzer)();
    console.log('✅ Пример завершен');
}
if (require.main === module) {
    example().catch(console.error);
}
//# sourceMappingURL=example.js.map