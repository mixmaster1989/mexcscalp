#!/usr/bin/env node
require('dotenv/config');
const Mexc = require('mexc-api-sdk');
const pino = require('pino');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

async function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

function roundTo(v, step){
  const decimals = (step.toString().split('.')[1]||'').length;
  const n = Math.round(v / step) * step;
  return Number(n.toFixed(decimals));
}

async function main(){
  const apiKey = process.env.MEXC_API_KEY;
  const apiSecret = process.env.MEXC_SECRET_KEY;
  if(!apiKey || !apiSecret){
    logger.error('Missing MEXC_API_KEY or MEXC_SECRET_KEY');
    process.exit(1);
  }
  const client = new Mexc.Spot(apiKey, apiSecret);

  const symbol = (process.env.SYMBOL || 'ETHUSDC').toUpperCase();
  const seedUsd = parseFloat(process.env.SEED_USD || '20');
  const deltaPct = parseFloat(process.env.SEED_DELTA_PCT || '0.001'); // 0.1%
  const minTicks = parseInt(process.env.SEED_MIN_TICKS || '3', 10);
  const ttlMs = parseInt(process.env.SEED_TTL_MS || '60000', 10);
  const tickSize = parseFloat(process.env.TICK_SIZE || '0.01');
  const stepSize = parseFloat(process.env.STEP_SIZE || '0.000001');

  logger.info({ symbol, seedUsd, deltaPct, minTicks, ttlMs }, 'Seed buy start');

  // 1) Cancel any existing SEED_BUY_ open order
  try {
    const opens = await client.openOrders(symbol);
    const seed = (opens || []).find(o => (o.clientOrderId||'').startsWith('SEED_BUY_'));
    if (seed) {
      await client.cancelOrder(symbol, { origClientOrderId: seed.clientOrderId });
      logger.info({ clientOrderId: seed.clientOrderId }, 'Cancelled existing SEED_BUY order');
      await sleep(800);
    }
  } catch (e) {
    logger.warn({ err: e }, 'Failed to check/cancel existing SEED_BUY');
  }

  // 2) Place LIMIT IOC BUY for ~seedUsd near the ask
  const bt = await client.bookTicker(symbol);
  const bid = parseFloat(bt.bidPrice || bt.bid || bt.bestBid || bt.b);
  const ask = parseFloat(bt.askPrice || bt.ask || bt.bestAsk || bt.a);
  if (!isFinite(ask) || !isFinite(bid)) {
    logger.error('No bid/ask price for calculation');
    process.exit(1);
  }
  const tick = parseFloat(process.env.TICK_SIZE || '0.01');
  const price = roundTo(ask + tick, tick); // чуть выше ask, чтобы исполнить сразу
  const qtyRaw = seedUsd / price;
  const fastStep = Math.max(stepSize, 0.00001);
  const qty = Math.max(fastStep, Math.floor(qtyRaw / fastStep) * fastStep);
  const coid = `SEED_BUY_${Date.now()}`;
  logger.info({ bid, ask, price, qty, coid }, 'Placing LIMIT IOC BUY');
  try {
    await client.newOrder(symbol, 'BUY', 'LIMIT', {
      timeInForce: 'IOC',
      price: price.toString(),
      quantity: qty.toString(),
      newClientOrderId: coid,
    });
    logger.info('Seed LIMIT IOC BUY submitted');
    process.exit(0);
  } catch (e) {
    logger.error({ err: e }, 'Seed LIMIT IOC BUY failed');
    process.exit(1);
  }
}

main().catch(e=>{ logger.error({ err: e }, 'Seed script fatal'); process.exit(1); });
