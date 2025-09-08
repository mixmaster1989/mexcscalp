"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigSchema = void 0;
const zod_1 = require("zod");
// Конфигурация (схема Zod)
exports.ConfigSchema = zod_1.z.object({
    symbol: zod_1.z.string(),
    deposit_usd: zod_1.z.number().positive(),
    fees_bps_round_trip: zod_1.z.number().min(0),
    risk: zod_1.z.object({
        max_notional_pct: zod_1.z.number().min(0).max(1),
        max_inventory_pct: zod_1.z.number().min(0).max(1),
        ladder_budget_pct: zod_1.z.number().min(0).max(1),
        kill_switch_losses: zod_1.z.number().int().positive(),
        daily_dd_stop_pct: zod_1.z.number().min(0).max(1),
        max_position_duration_sec: zod_1.z.number().positive(),
        cancel_rate_per_min: zod_1.z.number().positive()
    }),
    regime: zod_1.z.object({
        z_max: zod_1.z.number().positive(),
        quiet_spread_ticks: zod_1.z.number().positive(),
        atr_window_1m: zod_1.z.number().positive(),
        atr_window_5m: zod_1.z.number().positive(),
        vwap_window_sec: zod_1.z.number().positive(),
        obi_levels: zod_1.z.number().int().positive(),
        tfi_window_sec: zod_1.z.number().positive()
    }),
    hedgehog: zod_1.z.object({
        levels: zod_1.z.number().int().positive(),
        offset_k_atr1m: zod_1.z.number().positive(),
        step_k_atr1m: zod_1.z.number().positive(),
        tp_bps: zod_1.z.object({
            quiet: zod_1.z.number().positive(),
            normal: zod_1.z.number().positive(),
            shock: zod_1.z.number().positive()
        }),
        size_geometry_r: zod_1.z.number().min(1),
        skew_alpha: zod_1.z.number().min(0).max(1)
    }),
    ladder: zod_1.z.object({
        steps: zod_1.z.number().int().positive(),
        step_k_atr1m: zod_1.z.number().positive(),
        geom_r: zod_1.z.number().min(1),
        tp_bps: zod_1.z.number().positive(),
        panic_tail_atr5m: zod_1.z.number().positive(),
        panic_close_frac: zod_1.z.number().min(0).max(1),
        recenter_interval_sec: zod_1.z.number().positive()
    }),
    hybrid: zod_1.z.object({
        ladder_trigger_z: zod_1.z.number().positive(),
        enable_in_shock: zod_1.z.boolean(),
        min_spread_for_ladder: zod_1.z.number().positive()
    }),
    filters: zod_1.z.object({
        min_spread_ticks: zod_1.z.number().positive(),
        staleness_ms: zod_1.z.number().positive(),
        min_notional_usd: zod_1.z.number().positive(),
        min_depth_quote_usd: zod_1.z.number().positive(),
        obi_threshold: zod_1.z.number().min(0).max(1),
        tfi_threshold: zod_1.z.number().min(0).max(1)
    }),
    ttl: zod_1.z.object({
        order_sec: zod_1.z.number().positive(),
        refresh_sec: zod_1.z.number().positive()
    }),
    ws: zod_1.z.object({
        heartbeat_interval_ms: zod_1.z.number().positive(),
        reconnect_delay_ms: zod_1.z.number().positive(),
        max_reconnect_attempts: zod_1.z.number().int().positive()
    })
});
//# sourceMappingURL=types.js.map