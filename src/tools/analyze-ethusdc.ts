import axios from 'axios';
import 'dotenv/config';

interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const BASE_URL = process.env.MEXC_BASE_URL || 'https://api.mexc.com';
const SYMBOL = 'ETHUSDC';

const intervals = ['1m','5m','15m','60m','4h','1d'] as const;

type Interval = typeof intervals[number];

function defaultLimit(iv: Interval): number {
  switch (iv) {
    case '1m': return 1500;      // ~1-2 дня с запасом
    case '5m': return 2500;      // ~8-9 дней
    case '15m': return 800;      // ~8-9 дней
    case '60m': return 300;      // ~12-13 дней
    case '4h': return 120;       // ~20 дней
    case '1d': return 30;        // ~месяц
    default: return 1000;
  }
}

async function fetchKlines(interval: Interval, limit: number): Promise<Candle[]> {
  const resp = await axios.get(`${BASE_URL}/api/v3/klines`, { params: { symbol: SYMBOL, interval, limit } });
  return resp.data.map((k: any[]) => ({
    openTime: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5]
  }));
}

function atr(candles: Candle[], period: number): number {
  if (candles.length < period + 1) return NaN;
  let trSum = 0;
  for (let i = 1; i < period + 1; i++) {
    const c0 = candles[i - 1];
    const c1 = candles[i];
    const tr = Math.max(
      c1.high - c1.low,
      Math.abs(c1.high - c0.close),
      Math.abs(c1.low - c0.close)
    );
    trSum += tr;
  }
  return trSum / period;
}

function stdev(values: number[]): number {
  const n = values.length; if (n === 0) return 0;
  const mean = values.reduce((a,b)=>a+b,0)/n;
  const variance = values.reduce((a,b)=>a + (b-mean)*(b-mean),0)/n;
  return Math.sqrt(variance);
}

function summarize(candles: Candle[]) {
  const closes = candles.map(c=>c.close);
  const highs = candles.map(c=>c.high);
  const lows = candles.map(c=>c.low);
  const last = candles[candles.length-1];
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const range = max - min;
  const sd = stdev(closes);
  const atr14 = atr(candles.slice(-100), 14);
  return { lastClose: last.close, min, max, range, stdev: sd, atr14 };
}

async function main() {
  console.log(`🔎 Анализ ${SYMBOL} на интервалах: ${intervals.join(', ')}`);
  for (const iv of intervals) {
    try {
      const limit = defaultLimit(iv as Interval);
      const candles = await fetchKlines(iv as Interval, limit);
      const weekMs = 7*24*60*60*1000;
      const cutoff = Date.now() - weekMs;
      const lastWeek = candles.filter(c=>c.openTime >= cutoff);
      const sample = lastWeek.length > 0 ? lastWeek : candles;
      const stats = summarize(sample);
      const step = Math.max(stats.atr14 || stats.stdev*0.8, stats.range*0.002);
      const recommendedGrid = {
        center: stats.lastClose,
        step,
        levelsEachSide: Math.min(10, Math.max(3, Math.floor(stats.range / (2*step))))
      };
      console.log(`\n[${iv}] last=${stats.lastClose.toFixed(2)} min=${stats.min.toFixed(2)} max=${stats.max.toFixed(2)} range=${stats.range.toFixed(2)}`);
      console.log(`[${iv}] ATR14≈${(stats.atr14||0).toFixed(4)} stdev≈${stats.stdev.toFixed(4)} → step≈${step.toFixed(4)} levels≈${recommendedGrid.levelsEachSide}`);
    } catch (e:any) {
      console.error(`[${iv}] fetch error:`, e?.response?.status, e?.response?.data || e?.message);
    }
  }
}

if (require.main === module) {
  main().catch(err=>{ console.error('Error:', err?.message || err); process.exit(1); });
} 