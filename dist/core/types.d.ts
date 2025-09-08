import { z } from 'zod';
export type Side = 'buy' | 'sell';
export type OrderStatus = 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED' | 'EXPIRED';
export type OrderType = 'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT';
export type MarketRegime = 'quiet' | 'normal' | 'shock';
export type StrategyState = 'QUOTING' | 'FILLED' | 'REBALANCE' | 'PAUSE';
export type StrategyType = 'hedgehog' | 'ladder' | 'hybrid';
export type EventType = 'TICK' | 'FILL' | 'CANCEL' | 'REJECT' | 'ERROR' | 'RECONNECT' | 'REGIME_CHANGE';
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
export interface OBIData {
    value: number;
    bidDepth: number;
    askDepth: number;
    timestamp: number;
}
export interface TFIData {
    value: number;
    buyVolume: number;
    sellVolume: number;
    timestamp: number;
}
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
export interface TradeMetrics {
    tradeId: string;
    side: Side;
    entry: number;
    exit: number;
    quantity: number;
    pnl: number;
    mae: number;
    mfe: number;
    duration: number;
    regime: MarketRegime;
    strategy: StrategyType;
}
export interface SystemEvent {
    id: string;
    type: EventType;
    timestamp: number;
    payload: any;
}
export declare const ConfigSchema: z.ZodObject<{
    symbol: z.ZodString;
    deposit_usd: z.ZodNumber;
    fees_bps_round_trip: z.ZodNumber;
    risk: z.ZodObject<{
        max_notional_pct: z.ZodNumber;
        max_inventory_pct: z.ZodNumber;
        ladder_budget_pct: z.ZodNumber;
        kill_switch_losses: z.ZodNumber;
        daily_dd_stop_pct: z.ZodNumber;
        max_position_duration_sec: z.ZodNumber;
        cancel_rate_per_min: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        max_notional_pct: number;
        max_inventory_pct: number;
        ladder_budget_pct: number;
        kill_switch_losses: number;
        daily_dd_stop_pct: number;
        max_position_duration_sec: number;
        cancel_rate_per_min: number;
    }, {
        max_notional_pct: number;
        max_inventory_pct: number;
        ladder_budget_pct: number;
        kill_switch_losses: number;
        daily_dd_stop_pct: number;
        max_position_duration_sec: number;
        cancel_rate_per_min: number;
    }>;
    regime: z.ZodObject<{
        z_max: z.ZodNumber;
        quiet_spread_ticks: z.ZodNumber;
        atr_window_1m: z.ZodNumber;
        atr_window_5m: z.ZodNumber;
        vwap_window_sec: z.ZodNumber;
        obi_levels: z.ZodNumber;
        tfi_window_sec: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        z_max: number;
        quiet_spread_ticks: number;
        atr_window_1m: number;
        atr_window_5m: number;
        vwap_window_sec: number;
        obi_levels: number;
        tfi_window_sec: number;
    }, {
        z_max: number;
        quiet_spread_ticks: number;
        atr_window_1m: number;
        atr_window_5m: number;
        vwap_window_sec: number;
        obi_levels: number;
        tfi_window_sec: number;
    }>;
    hedgehog: z.ZodObject<{
        levels: z.ZodNumber;
        offset_k_atr1m: z.ZodNumber;
        step_k_atr1m: z.ZodNumber;
        tp_bps: z.ZodObject<{
            quiet: z.ZodNumber;
            normal: z.ZodNumber;
            shock: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            quiet: number;
            normal: number;
            shock: number;
        }, {
            quiet: number;
            normal: number;
            shock: number;
        }>;
        size_geometry_r: z.ZodNumber;
        skew_alpha: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        levels: number;
        offset_k_atr1m: number;
        step_k_atr1m: number;
        tp_bps: {
            quiet: number;
            normal: number;
            shock: number;
        };
        size_geometry_r: number;
        skew_alpha: number;
    }, {
        levels: number;
        offset_k_atr1m: number;
        step_k_atr1m: number;
        tp_bps: {
            quiet: number;
            normal: number;
            shock: number;
        };
        size_geometry_r: number;
        skew_alpha: number;
    }>;
    ladder: z.ZodObject<{
        steps: z.ZodNumber;
        step_k_atr1m: z.ZodNumber;
        geom_r: z.ZodNumber;
        tp_bps: z.ZodNumber;
        panic_tail_atr5m: z.ZodNumber;
        panic_close_frac: z.ZodNumber;
        recenter_interval_sec: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        step_k_atr1m: number;
        tp_bps: number;
        steps: number;
        geom_r: number;
        panic_tail_atr5m: number;
        panic_close_frac: number;
        recenter_interval_sec: number;
    }, {
        step_k_atr1m: number;
        tp_bps: number;
        steps: number;
        geom_r: number;
        panic_tail_atr5m: number;
        panic_close_frac: number;
        recenter_interval_sec: number;
    }>;
    hybrid: z.ZodObject<{
        ladder_trigger_z: z.ZodNumber;
        enable_in_shock: z.ZodBoolean;
        min_spread_for_ladder: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        ladder_trigger_z: number;
        enable_in_shock: boolean;
        min_spread_for_ladder: number;
    }, {
        ladder_trigger_z: number;
        enable_in_shock: boolean;
        min_spread_for_ladder: number;
    }>;
    filters: z.ZodObject<{
        min_spread_ticks: z.ZodNumber;
        staleness_ms: z.ZodNumber;
        min_notional_usd: z.ZodNumber;
        min_depth_quote_usd: z.ZodNumber;
        obi_threshold: z.ZodNumber;
        tfi_threshold: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        min_spread_ticks: number;
        staleness_ms: number;
        min_notional_usd: number;
        min_depth_quote_usd: number;
        obi_threshold: number;
        tfi_threshold: number;
    }, {
        min_spread_ticks: number;
        staleness_ms: number;
        min_notional_usd: number;
        min_depth_quote_usd: number;
        obi_threshold: number;
        tfi_threshold: number;
    }>;
    ttl: z.ZodObject<{
        order_sec: z.ZodNumber;
        refresh_sec: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        order_sec: number;
        refresh_sec: number;
    }, {
        order_sec: number;
        refresh_sec: number;
    }>;
    ws: z.ZodObject<{
        heartbeat_interval_ms: z.ZodNumber;
        reconnect_delay_ms: z.ZodNumber;
        max_reconnect_attempts: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        heartbeat_interval_ms: number;
        reconnect_delay_ms: number;
        max_reconnect_attempts: number;
    }, {
        heartbeat_interval_ms: number;
        reconnect_delay_ms: number;
        max_reconnect_attempts: number;
    }>;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    hedgehog: {
        levels: number;
        offset_k_atr1m: number;
        step_k_atr1m: number;
        tp_bps: {
            quiet: number;
            normal: number;
            shock: number;
        };
        size_geometry_r: number;
        skew_alpha: number;
    };
    ladder: {
        step_k_atr1m: number;
        tp_bps: number;
        steps: number;
        geom_r: number;
        panic_tail_atr5m: number;
        panic_close_frac: number;
        recenter_interval_sec: number;
    };
    hybrid: {
        ladder_trigger_z: number;
        enable_in_shock: boolean;
        min_spread_for_ladder: number;
    };
    deposit_usd: number;
    fees_bps_round_trip: number;
    risk: {
        max_notional_pct: number;
        max_inventory_pct: number;
        ladder_budget_pct: number;
        kill_switch_losses: number;
        daily_dd_stop_pct: number;
        max_position_duration_sec: number;
        cancel_rate_per_min: number;
    };
    regime: {
        z_max: number;
        quiet_spread_ticks: number;
        atr_window_1m: number;
        atr_window_5m: number;
        vwap_window_sec: number;
        obi_levels: number;
        tfi_window_sec: number;
    };
    filters: {
        min_spread_ticks: number;
        staleness_ms: number;
        min_notional_usd: number;
        min_depth_quote_usd: number;
        obi_threshold: number;
        tfi_threshold: number;
    };
    ttl: {
        order_sec: number;
        refresh_sec: number;
    };
    ws: {
        heartbeat_interval_ms: number;
        reconnect_delay_ms: number;
        max_reconnect_attempts: number;
    };
}, {
    symbol: string;
    hedgehog: {
        levels: number;
        offset_k_atr1m: number;
        step_k_atr1m: number;
        tp_bps: {
            quiet: number;
            normal: number;
            shock: number;
        };
        size_geometry_r: number;
        skew_alpha: number;
    };
    ladder: {
        step_k_atr1m: number;
        tp_bps: number;
        steps: number;
        geom_r: number;
        panic_tail_atr5m: number;
        panic_close_frac: number;
        recenter_interval_sec: number;
    };
    hybrid: {
        ladder_trigger_z: number;
        enable_in_shock: boolean;
        min_spread_for_ladder: number;
    };
    deposit_usd: number;
    fees_bps_round_trip: number;
    risk: {
        max_notional_pct: number;
        max_inventory_pct: number;
        ladder_budget_pct: number;
        kill_switch_losses: number;
        daily_dd_stop_pct: number;
        max_position_duration_sec: number;
        cancel_rate_per_min: number;
    };
    regime: {
        z_max: number;
        quiet_spread_ticks: number;
        atr_window_1m: number;
        atr_window_5m: number;
        vwap_window_sec: number;
        obi_levels: number;
        tfi_window_sec: number;
    };
    filters: {
        min_spread_ticks: number;
        staleness_ms: number;
        min_notional_usd: number;
        min_depth_quote_usd: number;
        obi_threshold: number;
        tfi_threshold: number;
    };
    ttl: {
        order_sec: number;
        refresh_sec: number;
    };
    ws: {
        heartbeat_interval_ms: number;
        reconnect_delay_ms: number;
        max_reconnect_attempts: number;
    };
}>;
export type Config = z.infer<typeof ConfigSchema>;
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
//# sourceMappingURL=types.d.ts.map