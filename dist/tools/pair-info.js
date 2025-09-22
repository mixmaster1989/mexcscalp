"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
require("dotenv/config");
const BASE_URL = process.env.MEXC_BASE_URL || 'https://api.mexc.com';
const SYMBOL = process.env.SYMBOL || 'ETHUSDC';
function get(obj, path, def) {
    return path.reduce((o, k) => (o && k in o ? o[k] : undefined), obj) ?? def;
}
async function main() {
    const url = `${BASE_URL}/api/v3/exchangeInfo`;
    const resp = await axios_1.default.get(url);
    const symbols = resp.data?.symbols || resp.data?.symbol_list || [];
    console.log('exchangeInfo keys:', Object.keys(resp.data));
    console.log('symbols length:', Array.isArray(symbols) ? symbols.length : 'n/a');
    const list = Array.isArray(symbols) ? symbols : [];
    const s = list.find((x) => x.symbol === SYMBOL);
    if (!s) {
        console.log(`Пара ${SYMBOL} не найдена`);
        return;
    }
    console.log('Symbol full object:\n', JSON.stringify(s, null, 2));
}
if (require.main === module) {
    main().catch(err => {
        console.error('Error:', err?.response?.status, err?.response?.data || err?.message || err);
        process.exit(1);
    });
}
//# sourceMappingURL=pair-info.js.map