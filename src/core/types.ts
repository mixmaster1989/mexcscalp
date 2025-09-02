import { z } from 'zod';

// Базовые торговые типы
export type Side = 'buy' | 'sell';
export type OrderStatus = 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED' | 'EXPIRED';
export type OrderType = 'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT';

// Режимы рынка
export type MarketRegime = 'quiet' | 'normal' | 'shock';

// Состояния стратегии
export type StrategyState = 'QUOTING' | 'FILLED' | 'REBALANCE' | 'PAUSE';

// Типы стратегий
export type StrategyType = 'hedgehog' | 'ladder' | 'hybrid';

// События системы
export type EventType = 'TICK' | 'FILL' | 'CANCEL' | 'REJECT' | 'ERROR' | 'RECONNECT' | 'REGIME_CHANGE';

// Структуры данных
export interface Tick {
  symbol: string;
  price: number;
  quantity: number;
  side: Side;
  timestamp: number;
}

export interface OrderbookLevel {
  price: number;
  quantity: number;
}

export interface Orderbook {
  symbol: string;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  timestamp: number;
  lastUpdateId: number;
}

export interface Trade {
  id: string;
  symbol: string;
  price: number;
  quantity: number;
  side: Side;
  timestamp: number;
  buyer: boolean;
}

export interface Order {
  id: string;
  clientOrderId: string;
  symbol: string;
  side: Side;
  type: OrderType;
  price: number;
  quantity: number;
  filled: number;
  status: OrderStatus;
  timestamp: number;
  updateTime?: number;
  strategy?: string;
  level?: number;
}

export interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  unrealizedPnl: number;
  timestamp: number;
}

export interface Fill {
  id: string;
  orderId: string;
  clientOrderId: string;
  symbol: string;
  price: number;
  quantity: number;
  fee: number;
  side: Side;
  timestamp: number;
}

// Индикаторы
export interface ATRData {
  value: number;
  period: number;
  timestamp: number;
}

export interface VWAPData {
  value: number;
  volume: number;
  timestamp: number;
}

export interface EMAData {
  value: number;
  period: number;
  timestamp: number;
}

// Микроструктурные индикаторы
export interface OBIData {
  value: number; // Order Book Imbalance
  bidDepth: number;
  askDepth: number;
  timestamp: number;
}

export interface TFIData {
  value: number; // Trade Flow Imbalance
  buyVolume: number;
  sellVolume: number;
  timestamp: number;
}

// Режим рынка
export interface RegimeData {
  regime: MarketRegime;
  confidence: number;
  indicators: {
    atr1m: number;
    atr5m: number;
    zScore: number;
    obi: number;
    tfi: number;
  };
  timestamp: number;
}

// Метрики торговли
export interface TradeMetrics {
  tradeId: string;
  side: Side;
  entry: number;
  exit: number;
  quantity: number;
  pnl: number;
  mae: number; // Maximum Adverse Excursion
  mfe: number; // Maximum Favorable Excursion
  duration: number;
  regime: MarketRegime;
  strategy: StrategyType;
}

// События системы
export interface SystemEvent {
  id: string;
  type: EventType;
  timestamp: number;
  payload: any;
}

// Конфигурация (схема Zod)
export const ConfigSchema = z.object({
  symbol: z.string(),
  deposit_usd: z.number().positive(),
  fees_bps_round_trip: z.number().min(0),
  
  risk: z.object({
    max_notional_pct: z.number().min(0).max(1),
    max_inventory_pct: z.number().min(0).max(1),
    ladder_budget_pct: z.number().min(0).max(1),
    kill_switch_losses: z.number().int().positive(),
    daily_dd_stop_pct: z.number().min(0).max(1),
    max_position_duration_sec: z.number().positive(),
    cancel_rate_per_min: z.number().positive()
  }),
  
  regime: z.object({
    z_max: z.number().positive(),
    quiet_spread_ticks: z.number().positive(),
    atr_window_1m: z.number().positive(),
    atr_window_5m: z.number().positive(),
    vwap_window_sec: z.number().positive(),
    obi_levels: z.number().int().positive(),
    tfi_window_sec: z.number().positive()
  }),
  
  hedgehog: z.object({
    levels: z.number().int().positive(),
    offset_k_atr1m: z.number().positive(),
    step_k_atr1m: z.number().positive(),
    tp_bps: z.object({
      quiet: z.number().positive(),
      normal: z.number().positive(),
      shock: z.number().positive()
    }),
    size_geometry_r: z.number().min(1),
    skew_alpha: z.number().min(0).max(1)
  }),
  
  ladder: z.object({
    steps: z.number().int().positive(),
    step_k_atr1m: z.number().positive(),
    geom_r: z.number().min(1),
    tp_bps: z.number().positive(),
    panic_tail_atr5m: z.number().positive(),
    panic_close_frac: z.number().min(0).max(1),
    recenter_interval_sec: z.number().positive()
  }),
  
  hybrid: z.object({
    ladder_trigger_z: z.number().positive(),
    enable_in_shock: z.boolean(),
    min_spread_for_ladder: z.number().positive()
  }),
  
  filters: z.object({
    min_spread_ticks: z.number().positive(),
    staleness_ms: z.number().positive(),
    min_notional_usd: z.number().positive(),
    min_depth_quote_usd: z.number().positive(),
    obi_threshold: z.number().min(0).max(1),
    tfi_threshold: z.number().min(0).max(1)
  }),
  
  ttl: z.object({
    order_sec: z.number().positive(),
    refresh_sec: z.number().positive()
  }),
  
  ws: z.object({
    heartbeat_interval_ms: z.number().positive(),
    reconnect_delay_ms: z.number().positive(),
    max_reconnect_attempts: z.number().int().positive()
  })
});

export type Config = z.infer<typeof ConfigSchema>;

// Инструмент
export interface Instrument {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  tickSize: number;
  stepSize: number;
  minNotional: number;
  maxNotional?: number;
  minQty: number;
  maxQty?: number;
}

// Информация об аккаунте
export interface AccountInfo {
  balances: Array<{
    asset: string;
    free: number;
    locked: number;
  }>;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime: number;
} 