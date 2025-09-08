export interface OrderBookTick {
  symbol: string;
  bidPrice: number;
  bidQty: number;
  askPrice: number;
  askQty: number;
  timestamp: number;
}

export interface TradeTick {
  symbol: string;
  price: number;
  qty: number;
  side?: string;
  timestamp: number;
}

export interface MicroStats {
  mid: number;
  spread: number;
  sigma1s: number;
  s: number;
  tp: number;
  sl: number;
  timestamp?: number;
}

export interface SessionStats {
  totalPnL: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  consecutiveLosses: number;
  fillsPerMinute: number;
  avgTradeDuration: number;
  dailyDrawdown: number;
  startTime: number;
  lastTradeTime: number;
}

export enum LayerState {
  IDLE = 'IDLE',
  PENDING_BUY = 'PENDING_BUY',
  LONG_PING = 'LONG_PING',
  COOLDOWN = 'COOLDOWN'
}

export interface Layer {
  id: string;
  state: LayerState;
  buyOrderId?: string;
  sellOrderId?: string;
  buyPrice?: number;
  sellPrice?: number;
  entryPrice?: number;
  quantity?: number;
  slPrice?: number;
  expireAt?: number;
  resumeAt?: number;
}

export interface Config {
  symbol: string;
  orderNotional: number;
  maxLayers: number;
  ksig: number;
  sMinPercent: number;
  sMaxPercent: number;
  tpMultiplier: number;
  slMultiplier: number;
  ttlSeconds: number;
  cooldownSeconds: number;
  maxLongQtyPercent: number;
  stopDayPercent: number;
  maxConsecutiveLosses: number;
  spikeThresholdMultiplier: number;
  spikeThresholdMin: number;
  updateIntervalMs: number;
  watchdogTimeoutSeconds: number;
  killSwitchTimeoutSeconds: number;
  dryRun: boolean;
}

export interface AccountInfo {
  balances: Array<{
    asset: string;
    free: string;
    locked: string;
  }>;
}

export interface Order {
  id: string;
  symbol: string;
  side: string;
  type: string;
  quantity: number;
  price: number;
  status: string;
  timestamp: number;
}

export interface Trade {
  id: string;
  symbol: string;
  side: string;
  price: number;
  qty: number;
  timestamp: number;
}

export interface Position {
  symbol: string;
  side: string;
  size: number;
  entryPrice: number;
  markPrice: number;
  pnl: number;
  timestamp: number;
}
