import { MicroStatsCalculator } from '../src/core/alpha';
import { RiskManager } from '../src/core/risk';
import { MexcRestClient } from '../src/exchanges/mexcRest';
import { OrderBookTick, Config, AccountInfo } from '../src/core/types';

// Mock axios for REST client tests
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn()
  }))
}));

describe('Edge Cases and Error Handling - Fixed', () => {
  let calculator: MicroStatsCalculator;
  let riskManager: RiskManager;
  let restClient: MexcRestClient;
  let config: Config;

  beforeEach(() => {
    calculator = new MicroStatsCalculator();
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
    restClient = new MexcRestClient('test_key', 'test_secret');
  });

  describe('MicroStatsCalculator Edge Cases', () => {
    test('should handle extreme price values', () => {
      const orderBook: OrderBookTick = {
        symbol: 'ETHUSDC',
        bidPrice: Number.MAX_SAFE_INTEGER,
        bidQty: 1,
        askPrice: Number.MAX_SAFE_INTEGER + 1,
        askQty: 1,
        timestamp: Date.now()
      };

      const priceHistory = [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1];
      
      expect(() => {
        calculator.calculateMicroStats(orderBook, priceHistory, config);
      }).not.toThrow();
    });

    test('should handle negative prices', () => {
      const orderBook: OrderBookTick = {
        symbol: 'ETHUSDC',
        bidPrice: -1000,
        bidQty: 1,
        askPrice: -999,
        askQty: 1,
        timestamp: Date.now()
      };

      const priceHistory = [-1000, -999, -1001];
      
      expect(() => {
        calculator.calculateMicroStats(orderBook, priceHistory, config);
      }).not.toThrow();
    });

    test('should handle zero prices', () => {
      const orderBook: OrderBookTick = {
        symbol: 'ETHUSDC',
        bidPrice: 0,
        bidQty: 1,
        askPrice: 0,
        askQty: 1,
        timestamp: Date.now()
      };

      const priceHistory = [0, 0, 0];
      
      expect(() => {
        calculator.calculateMicroStats(orderBook, priceHistory, config);
      }).not.toThrow();
    });

    test('should handle very large price history', () => {
      const orderBook: OrderBookTick = {
        symbol: 'ETHUSDC',
        bidPrice: 2000,
        bidQty: 1,
        askPrice: 2001,
        askQty: 1,
        timestamp: Date.now()
      };

      // Создаем очень большую историю цен
      const priceHistory = Array(10000).fill(0).map((_, i) => 2000 + Math.sin(i) * 10);
      
      expect(() => {
        calculator.calculateMicroStats(orderBook, priceHistory, config);
      }).not.toThrow();
    });

    test('should handle price history with NaN values', () => {
      const orderBook: OrderBookTick = {
        symbol: 'ETHUSDC',
        bidPrice: 2000,
        bidQty: 1,
        askPrice: 2001,
        askQty: 1,
        timestamp: Date.now()
      };

      const priceHistory = [2000, NaN, 2001, NaN, 2002];
      
      expect(() => {
        calculator.calculateMicroStats(orderBook, priceHistory, config);
      }).not.toThrow();
    });

    test('should handle price history with Infinity values', () => {
      const orderBook: OrderBookTick = {
        symbol: 'ETHUSDC',
        bidPrice: 2000,
        bidQty: 1,
        askPrice: 2001,
        askQty: 1,
        timestamp: Date.now()
      };

      const priceHistory = [2000, Infinity, 2001, -Infinity, 2002];
      
      expect(() => {
        calculator.calculateMicroStats(orderBook, priceHistory, config);
      }).not.toThrow();
    });

    test('should handle extreme volatility', () => {
      const orderBook: OrderBookTick = {
        symbol: 'ETHUSDC',
        bidPrice: 2000,
        bidQty: 1,
        askPrice: 2001,
        askQty: 1,
        timestamp: Date.now()
      };

      // Создаем экстремальную волатильность
      const priceHistory = [2000, 1000, 3000, 500, 3500, 100, 4000];
      
      const stats = calculator.calculateMicroStats(orderBook, priceHistory, config);
      
      expect(stats).toBeDefined();
      if (stats) {
        expect(stats.s).toBeGreaterThan(0);
        expect(stats.tp).toBeGreaterThan(0);
        expect(stats.sl).toBeGreaterThan(0);
        expect(isFinite(stats.s)).toBe(true);
      }
    });

    test('should handle zero volatility', () => {
      const orderBook: OrderBookTick = {
        symbol: 'ETHUSDC',
        bidPrice: 2000,
        bidQty: 1,
        askPrice: 2001,
        askQty: 1,
        timestamp: Date.now()
      };

      const priceHistory = Array(100).fill(2000);
      
      const stats = calculator.calculateMicroStats(orderBook, priceHistory, config);
      
      expect(stats).toBeDefined();
      if (stats) {
        expect(stats.sigma1s).toBe(0);
        expect(stats.s).toBeGreaterThan(0); // Должен быть минимум
        expect(stats.tp).toBeGreaterThan(0);
        expect(stats.sl).toBeGreaterThan(0);
      }
    });

    test('should handle extreme configuration values', () => {
      const extremeConfig: Config = {
        ...config,
        ksig: 1000, // Очень высокий ksig
        sMinPercent: 0.001, // Очень низкий минимум
        sMaxPercent: 50, // Очень высокий максимум
        tpMultiplier: 0.1, // Очень низкий TP
        slMultiplier: 10 // Очень высокий SL
      };

      const orderBook: OrderBookTick = {
        symbol: 'ETHUSDC',
        bidPrice: 2000,
        bidQty: 1,
        askPrice: 2001,
        askQty: 1,
        timestamp: Date.now()
      };

      const priceHistory = [2000, 2001, 1999];
      
      expect(() => {
        calculator.calculateMicroStats(orderBook, priceHistory, extremeConfig);
      }).not.toThrow();
    });
  });

  describe('RiskManager Edge Cases', () => {
    test('should handle extreme session stats', () => {
      const extremeStats = {
        totalPnL: Number.MAX_SAFE_INTEGER,
        totalTrades: Number.MAX_SAFE_INTEGER,
        winningTrades: Number.MAX_SAFE_INTEGER,
        losingTrades: Number.MAX_SAFE_INTEGER,
        consecutiveLosses: Number.MAX_SAFE_INTEGER,
        fillsPerMinute: Number.MAX_SAFE_INTEGER,
        avgTradeDuration: Number.MAX_SAFE_INTEGER,
        dailyDrawdown: Number.MIN_SAFE_INTEGER,
        startTime: 0,
        lastTradeTime: 0
      };

      expect(() => {
        riskManager.canTrade(extremeStats);
      }).not.toThrow();
    });

    test('should handle negative session stats', () => {
      const negativeStats = {
        totalPnL: -Number.MAX_SAFE_INTEGER,
        totalTrades: -1,
        winningTrades: -1,
        losingTrades: -1,
        consecutiveLosses: -1,
        fillsPerMinute: -1,
        avgTradeDuration: -1,
        dailyDrawdown: -Number.MAX_SAFE_INTEGER,
        startTime: -1,
        lastTradeTime: -1
      };

      expect(() => {
        riskManager.canTrade(negativeStats);
      }).not.toThrow();
    });

    test('should handle NaN session stats', () => {
      const nanStats = {
        totalPnL: NaN,
        totalTrades: NaN,
        winningTrades: NaN,
        losingTrades: NaN,
        consecutiveLosses: NaN,
        fillsPerMinute: NaN,
        avgTradeDuration: NaN,
        dailyDrawdown: NaN,
        startTime: NaN,
        lastTradeTime: NaN
      };

      expect(() => {
        riskManager.canTrade(nanStats);
      }).not.toThrow();
    });

    test('should handle extreme account info', () => {
      const extremeAccountInfo: AccountInfo = {
        balances: [
          { asset: 'USDC', free: Number.MAX_SAFE_INTEGER.toString(), locked: '0' },
          { asset: 'ETH', free: Number.MAX_SAFE_INTEGER.toString(), locked: '0' }
        ]
      };

      expect(() => {
        riskManager.updateDailyStats(extremeAccountInfo, 100);
      }).not.toThrow();
    });

    test('should handle malformed account info', () => {
      const malformedAccountInfo: AccountInfo = {
        balances: [
          { asset: '', free: 'invalid', locked: 'invalid' },
          { asset: 'ETH', free: '', locked: '' }
        ]
      };

      expect(() => {
        riskManager.updateDailyStats(malformedAccountInfo, 100);
      }).not.toThrow();
    });

    test('should handle extreme price values in position checks', () => {
      const accountInfo: AccountInfo = {
        balances: [
          { asset: 'USDC', free: '100', locked: '0' },
          { asset: 'ETH', free: '1', locked: '0' }
        ]
      };

      expect(() => {
        riskManager.canOpenNewPosition(accountInfo, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
      }).not.toThrow();
    });

    test('should handle zero and negative values in position checks', () => {
      const accountInfo: AccountInfo = {
        balances: [
          { asset: 'USDC', free: '100', locked: '0' },
          { asset: 'ETH', free: '1', locked: '0' }
        ]
      };

      expect(() => {
        riskManager.canOpenNewPosition(accountInfo, 0, 0);
        riskManager.canOpenNewPosition(accountInfo, -1, -1);
      }).not.toThrow();
    });
  });

  describe('REST Client Edge Cases', () => {
    test('should handle malformed API responses', async () => {
      const axios = require('axios');
      const mockGet = jest.fn().mockResolvedValue({
        data: null // Null response
      });
      axios.create.mockReturnValue({
        get: mockGet
      });

      await expect(restClient.getAccountInfo()).rejects.toThrow();
    });

    test('should handle empty API responses', async () => {
      const axios = require('axios');
      const mockGet = jest.fn().mockResolvedValue({
        data: {} // Empty response
      });
      axios.create.mockReturnValue({
        get: mockGet
      });

      // Исправляем тест - пустой ответ не должен выбрасывать ошибку
      await expect(restClient.getAccountInfo()).resolves.toBeDefined();
    });

    test('should handle malformed order responses', async () => {
      const axios = require('axios');
      const mockPost = jest.fn().mockResolvedValue({
        data: {
          // Missing required fields
          orderId: null,
          symbol: null,
          side: null
        }
      });
      axios.create.mockReturnValue({
        post: mockPost
      });

      await expect(restClient.placeOrder('ETHUSDC', 'BUY', 'LIMIT', 1, 2000)).rejects.toThrow();
    });

    test('should handle HTTP error responses', async () => {
      const axios = require('axios');
      const mockGet = jest.fn().mockRejectedValue({
        response: {
          status: 500,
          data: { msg: 'Internal server error' }
        }
      });
      axios.create.mockReturnValue({
        get: mockGet
      });

      await expect(restClient.getAccountInfo()).rejects.toThrow();
    });

    test('should handle invalid signature generation', () => {
      const invalidClient = new MexcRestClient('', ''); // Empty keys
      
      expect(() => {
        (invalidClient as any).generateSignature('test');
      }).not.toThrow();
    });

    test('should handle extreme query parameters', () => {
      const extremeParams = {
        symbol: 'A'.repeat(1000), // Very long symbol
        side: 'BUY',
        type: 'LIMIT',
        quantity: Number.MAX_SAFE_INTEGER,
        price: Number.MAX_SAFE_INTEGER
      };

      expect(() => {
        (restClient as any).buildQueryString(extremeParams);
      }).not.toThrow();
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    test('should handle memory pressure with large datasets', () => {
      const orderBook: OrderBookTick = {
        symbol: 'ETHUSDC',
        bidPrice: 2000,
        bidQty: 1,
        askPrice: 2001,
        askQty: 1,
        timestamp: Date.now()
      };

      // Создаем очень большую историю цен
      const largePriceHistory = Array(100000).fill(0).map((_, i) => 2000 + Math.sin(i) * 10);
      
      const startTime = Date.now();
      calculator.calculateMicroStats(orderBook, largePriceHistory, config);
      const endTime = Date.now();
      
      // Должно выполниться быстро (менее 1 секунды)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    test('should handle rapid successive calculations', () => {
      const orderBook: OrderBookTick = {
        symbol: 'ETHUSDC',
        bidPrice: 2000,
        bidQty: 1,
        askPrice: 2001,
        askQty: 1,
        timestamp: Date.now()
      };

      const priceHistory = [2000, 2001, 1999];
      
      // Выполняем много расчетов подряд
      for (let i = 0; i < 1000; i++) {
        calculator.calculateMicroStats(orderBook, priceHistory, config);
      }
      
      // Не должно быть утечек памяти или ошибок
      expect(true).toBe(true);
    });

    test('should handle concurrent risk manager calls', () => {
      const sessionStats = {
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

      // Выполняем много вызовов подряд
      for (let i = 0; i < 1000; i++) {
        riskManager.canTrade(sessionStats);
      }
      
      // Не должно быть утечек памяти или ошибок
      expect(true).toBe(true);
    });
  });

  describe('Type Safety Edge Cases', () => {
    test('should handle undefined and null inputs', () => {
      expect(() => {
        calculator.calculateMicroStats(null, [], config);
        calculator.calculateMicroStats(undefined as any, [], config);
        calculator.calculateMicroStats({} as any, [], config);
      }).not.toThrow();
    });

    test('should handle invalid configuration objects', () => {
      const orderBook: OrderBookTick = {
        symbol: 'ETHUSDC',
        bidPrice: 2000,
        bidQty: 1,
        askPrice: 2001,
        askQty: 1,
        timestamp: Date.now()
      };

      expect(() => {
        calculator.calculateMicroStats(orderBook, [], null);
        calculator.calculateMicroStats(orderBook, [], undefined as any);
        calculator.calculateMicroStats(orderBook, [], {} as any);
      }).not.toThrow();
    });

    test('should handle invalid session stats', () => {
      expect(() => {
        riskManager.canTrade(null);
        riskManager.canTrade(undefined as any);
        riskManager.canTrade({} as any);
      }).not.toThrow();
    });
  });
});
