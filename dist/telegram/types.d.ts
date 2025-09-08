/**
 * Типы для Telegram бота
 */
export interface TelegramUser {
    chatId: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    isAuthorized: boolean;
    role: 'admin' | 'viewer';
    registeredAt: number;
    lastActiveAt: number;
}
export interface TelegramNotification {
    type: 'trade' | 'error' | 'regime_change' | 'system' | 'alert';
    title: string;
    message: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    timestamp: number;
    data?: any;
}
export interface BotCommand {
    command: string;
    description: string;
    adminOnly: boolean;
    handler: string;
}
export interface BotStats {
    totalUsers: number;
    activeUsers: number;
    messagesReceived: number;
    messagesSent: number;
    uptime: number;
    lastRestart: number;
}
export interface TradingStats {
    isActive: boolean;
    currentRegime: string;
    activeLevels: number;
    activeTPs: number;
    inventory: number;
    inventoryNotional: number;
    midPrice: number;
    pnlToday: number;
    tradesCount: number;
    winRate: number;
    totalTrades: number;
    profitableTrades: number;
    losingTrades: number;
    totalPnL: number;
    dailyPnL: number;
    maxDrawdown: number;
}
export interface SystemStatus {
    bot: {
        status: 'running' | 'stopped' | 'error';
        uptime: number;
        version: string;
    };
    trading: {
        status: 'active' | 'paused' | 'stopped';
        regime: string;
        lastUpdate: number;
    };
    api: {
        rest: boolean;
        websocket: boolean;
        lastCheck: number;
    };
    database: {
        connected: boolean;
        lastBackup: number;
    };
    systemStatus: string;
    tradingEnabled: boolean;
    totalBalance: number;
}
//# sourceMappingURL=types.d.ts.map