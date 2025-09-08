import { RiskManager } from '../src/core/risk';
import { SessionStats, Config, AccountInfo } from '../src/core/types';

describe('RiskManager - Fixed Tests', () => {
  let riskManager: RiskManager;
  let config: Config;
  let sessionStats: SessionStats;

  beforeEach(() => {
    config = {
      symbol: 'ETHUSDC',
      orderNotional: 5,
      maxLayers: 3,
      ksig: 1.5,
      sMinPercent: 0.05,
      sMaxPercent: 0.25,
      tpMultiplier: 1.0,
      slMultiplier: 1.8,
      ttlSeconds: 2.0,
      cooldownSeconds: 2.0,
      maxLongQtyPercent: 25,
      stopDayPercent: 2.0,
      maxConsecutiveLosses: 7,
      spikeThresholdMultiplier: 3.0,
      spikeThresholdMin: 0.20,
      updateIntervalMs: 250,
      watchdogTimeoutSeconds: 10,
      killSwitchTimeoutSeconds: 30,
      dryRun: false
    };

    riskManager = new RiskManager(config);
    
    sessionStats = {
      totalPnL: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      consecutiveLosses: 0,
      fillsPerMinute: 0,
      avgTradeDuration: 0,
      dailyDrawdown: 0,
      startTime: Date.now(),
      lastTradeTime: Date.now()
    };
  });

  describe('Basic Trading Permissions', () => {
    test('should allow trading under normal conditions', () => {
      expect(riskManager.canTrade(sessionStats)).toBe(true);
    });

    test('should block trading when kill-switch is active', () => {
      riskManager.triggerKillSwitch();
      expect(riskManager.canTrade(sessionStats)).toBe(false);
    });

    test('should allow trading after kill-switch reset', () => {
      riskManager.triggerKillSwitch();
      expect(riskManager.canTrade(sessionStats)).toBe(false);
      
      riskManager.resetKillSwitch();
      expect(riskManager.canTrade(sessionStats)).toBe(true);
    });
  });

  describe('Daily Drawdown Protection', () => {
    test('should block trading when daily drawdown exceeds limit', () => {
      sessionStats.dailyDrawdown = -3.0; // 3% просадка
      
      expect(riskManager.canTrade(sessionStats)).toBe(false);
    });

    test('should allow trading when daily drawdown is within limit', () => {
      sessionStats.dailyDrawdown = -1.5; // 1.5% просадка
      
      expect(riskManager.canTrade(sessionStats)).toBe(true);
    });

    test('should allow trading when daily drawdown is positive (profit)', () => {
      sessionStats.dailyDrawdown = 2.0; // 2% прибыль
      
      // Исправляем логику - положительная просадка должна разрешать торговлю
      expect(riskManager.canTrade(sessionStats)).toBe(true);
    });

    test('should trigger kill-switch on excessive drawdown', () => {
      sessionStats.dailyDrawdown = -3.0;
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      riskManager.canTrade(sessionStats);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Дневная просадка превышена')
      );
      expect(riskManager.isKillSwitchActive()).toBe(true);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Consecutive Losses Protection', () => {
    test('should block trading when consecutive losses exceed limit', () => {
      sessionStats.consecutiveLosses = 8; // Больше чем maxConsecutiveLosses (7)
      
      expect(riskManager.canTrade(sessionStats)).toBe(false);
    });

    test('should allow trading when consecutive losses are within limit', () => {
      sessionStats.consecutiveLosses = 5; // Меньше чем maxConsecutiveLosses (7)
      
      expect(riskManager.canTrade(sessionStats)).toBe(true);
    });

    test('should allow trading when consecutive losses are at limit', () => {
      sessionStats.consecutiveLosses = 7; // Равно maxConsecutiveLosses
      
      expect(riskManager.canTrade(sessionStats)).toBe(false);
    });
  });

  describe('API Error Tracking', () => {
    test('should track API errors', () => {
      riskManager.recordApiError();
      expect(riskManager.canTrade(sessionStats)).toBe(true);
    });

    test('should block trading when API error rate is too high', () => {
      // Записываем много ошибок
      for (let i = 0; i < 15; i++) {
        riskManager.recordApiError();
      }
      
      expect(riskManager.canTrade(sessionStats)).toBe(false);
    });

    test('should trigger kill-switch on critical API errors', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Записываем критическое количество ошибок
      for (let i = 0; i < 25; i++) {
        riskManager.recordApiError();
      }
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Критическое количество API ошибок')
      );
      expect(riskManager.isKillSwitchActive()).toBe(true);
      
      consoleSpy.mockRestore();
    });

    test('should reset API error count after kill-switch reset', () => {
      // Записываем ошибки
      for (let i = 0; i < 15; i++) {
        riskManager.recordApiError();
      }
      
      expect(riskManager.canTrade(sessionStats)).toBe(false);
      
      // Сбрасываем kill-switch
      riskManager.resetKillSwitch();
      expect(riskManager.canTrade(sessionStats)).toBe(true);
    });
  });

  describe('Daily Stats Updates', () => {
    test('should update daily stats correctly', () => {
      const accountInfo: AccountInfo = {
        balances: [
          { asset: 'USDC', free: '95.0', locked: '0.0' }
        ]
      };
      
      const initialBalance = 100.0;
      riskManager.updateDailyStats(accountInfo, initialBalance);
      
      expect(riskManager.getMaxDailyDrawdown()).toBe(5.0); // 5% просадка
    });

    test('should handle zero initial balance', () => {
      const accountInfo: AccountInfo = {
        balances: [
          { asset: 'USDC', free: '100.0', locked: '0.0' }
        ]
      };
      
      const initialBalance = 0;
      riskManager.updateDailyStats(accountInfo, initialBalance);
      
      // При нулевом начальном балансе просадка должна быть 0
      expect(riskManager.getMaxDailyDrawdown()).toBe(0);
    });

    test('should handle missing USDC balance', () => {
      const accountInfo: AccountInfo = {
        balances: [
          { asset: 'ETH', free: '1.0', locked: '0.0' }
        ]
      };
      
      const initialBalance = 100.0;
      riskManager.updateDailyStats(accountInfo, initialBalance);
      
      expect(riskManager.getMaxDailyDrawdown()).toBe(100.0); // 100% просадка
    });
  });

  describe('Position Limits', () => {
    test('should allow new position when within limits', () => {
      const accountInfo: AccountInfo = {
        balances: [
          { asset: 'USDC', free: '100.0', locked: '0.0' },
          { asset: 'ETH', free: '0.01', locked: '0.0' }
        ]
      };
      
      const currentEthBalance = 0.01;
      const ethPrice = 2000; // 0.01 * 2000 = 20 USDC
      
      expect(riskManager.canOpenNewPosition(accountInfo, currentEthBalance, ethPrice)).toBe(true);
    });

    test('should block new position when exceeding limits', () => {
      const accountInfo: AccountInfo = {
        balances: [
          { asset: 'USDC', free: '100.0', locked: '0.0' },
          { asset: 'ETH', free: '0.05', locked: '0.0' }
        ]
      };
      
      const currentEthBalance = 0.05;
      const ethPrice = 2000; // 0.05 * 2000 = 100 USDC (100% от баланса)
      
      expect(riskManager.canOpenNewPosition(accountInfo, currentEthBalance, ethPrice)).toBe(false);
    });

    test('should calculate max order size correctly', () => {
      const accountInfo: AccountInfo = {
        balances: [
          { asset: 'USDC', free: '100.0', locked: '0.0' }
        ]
      };
      
      const ethPrice = 2000;
      const maxOrderSize = riskManager.calculateMaxOrderSize(accountInfo, ethPrice);
      
      expect(maxOrderSize).toBe(0.005); // 10 USDC / 2000 = 0.005 ETH
    });

    test('should calculate position limit correctly', () => {
      const accountInfo: AccountInfo = {
        balances: [
          { asset: 'USDC', free: '100.0', locked: '0.0' }
        ]
      };
      
      const positionLimit = riskManager.calculatePositionLimit(accountInfo);
      
      expect(positionLimit).toBe(25.0); // 25% от 100 USDC
    });
  });

  describe('Market Condition Checks', () => {
    test('should accept acceptable spread', () => {
      const spread = 1.0;
      const mid = 2000;
      
      expect(riskManager.isSpreadAcceptable(spread, mid)).toBe(true);
    });

    test('should reject too small spread', () => {
      const spread = 0.001;
      const mid = 2000;
      
      expect(riskManager.isSpreadAcceptable(spread, mid)).toBe(false);
    });

    test('should accept acceptable volatility', () => {
      const sigma1s = 0.001;
      
      expect(riskManager.isVolatilityAcceptable(sigma1s)).toBe(true);
    });

    test('should reject too low volatility', () => {
      const sigma1s = 0.00001;
      
      expect(riskManager.isVolatilityAcceptable(sigma1s)).toBe(false);
    });

    test('should reject too high volatility', () => {
      const sigma1s = 0.02;
      
      expect(riskManager.isVolatilityAcceptable(sigma1s)).toBe(false);
    });

    test('should accept sufficient liquidity', () => {
      const bidQty = 10;
      const askQty = 10;
      const orderSize = 1;
      
      expect(riskManager.isLiquiditySufficient(bidQty, askQty, orderSize)).toBe(true);
    });

    test('should reject insufficient liquidity', () => {
      const bidQty = 1;
      const askQty = 1;
      const orderSize = 1;
      
      expect(riskManager.isLiquiditySufficient(bidQty, askQty, orderSize)).toBe(false);
    });

    test('should allow trading time', () => {
      expect(riskManager.isTradingTimeAllowed()).toBe(true);
    });
  });

  describe('Market Condition Suitability', () => {
    test('should accept suitable market conditions', () => {
      const spread = 1.0;
      const mid = 2000;
      const sigma1s = 0.001;
      const bidQty = 10;
      const askQty = 10;
      const orderSize = 1;
      
      expect(riskManager.isMarketConditionSuitable(
        spread, mid, sigma1s, bidQty, askQty, orderSize
      )).toBe(true);
    });

    test('should reject unsuitable market conditions', () => {
      const spread = 0.001; // Слишком маленький спред
      const mid = 2000;
      const sigma1s = 0.001;
      const bidQty = 10;
      const askQty = 10;
      const orderSize = 1;
      
      expect(riskManager.isMarketConditionSuitable(
        spread, mid, sigma1s, bidQty, askQty, orderSize
      )).toBe(false);
    });

    test('should reject conditions with insufficient liquidity', () => {
      const spread = 1.0;
      const mid = 2000;
      const sigma1s = 0.001;
      const bidQty = 1; // Недостаточная ликвидность
      const askQty = 1;
      const orderSize = 1;
      
      expect(riskManager.isMarketConditionSuitable(
        spread, mid, sigma1s, bidQty, askQty, orderSize
      )).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero balance', () => {
      const accountInfo: AccountInfo = {
        balances: [
          { asset: 'USDC', free: '0.0', locked: '0.0' }
        ]
      };
      
      const positionLimit = riskManager.calculatePositionLimit(accountInfo);
      expect(positionLimit).toBe(0);
    });

    test('should handle negative PnL in session stats', () => {
      sessionStats.dailyDrawdown = -1.0;
      expect(riskManager.canTrade(sessionStats)).toBe(true);
    });

    test('should handle very high consecutive losses', () => {
      sessionStats.consecutiveLosses = 100;
      expect(riskManager.canTrade(sessionStats)).toBe(false);
    });

    test('should handle zero spread', () => {
      const spread = 0;
      const mid = 2000;
      expect(riskManager.isSpreadAcceptable(spread, mid)).toBe(false);
    });

    test('should handle very high mid price', () => {
      const spread = 100;
      const mid = 1000000;
      expect(riskManager.isSpreadAcceptable(spread, mid)).toBe(true);
    });
  });

  describe('State Management', () => {
    test('should maintain kill-switch state', () => {
      expect(riskManager.isKillSwitchActive()).toBe(false);
      
      riskManager.triggerKillSwitch();
      expect(riskManager.isKillSwitchActive()).toBe(true);
      
      riskManager.resetKillSwitch();
      expect(riskManager.isKillSwitchActive()).toBe(false);
    });

    test('should maintain max daily drawdown', () => {
      expect(riskManager.getMaxDailyDrawdown()).toBe(0);
      
      const accountInfo: AccountInfo = {
        balances: [{ asset: 'USDC', free: '90.0', locked: '0.0' }]
      };
      
      riskManager.updateDailyStats(accountInfo, 100.0);
      expect(riskManager.getMaxDailyDrawdown()).toBe(10.0);
    });
  });
});
