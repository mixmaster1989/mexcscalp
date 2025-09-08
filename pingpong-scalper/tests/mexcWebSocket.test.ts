import { MexcWebSocketClient } from '../src/exchanges/mexcWebSocket';
import { EventEmitter } from 'events';

// Mock WebSocket
class MockWebSocket extends EventEmitter {
  public readyState = 1; // OPEN
  public send = jest.fn();
  public close = jest.fn();
  public ping = jest.fn();
}

// Mock global WebSocket
(global as any).WebSocket = MockWebSocket;

describe('MexcWebSocketClient', () => {
  let client: MexcWebSocketClient;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    client = new MexcWebSocketClient('ETHUSDC');
    mockWs = new MockWebSocket();
    (global as any).WebSocket = jest.fn(() => mockWs);
  });

  test('should connect to WebSocket', (done) => {
    client.on('connected', () => {
      expect(client.isConnectedToWebSocket()).toBe(true);
      done();
    });

    client.connect();
    mockWs.emit('open');
  });

  test('should subscribe to channels on connection', (done) => {
    client.on('connected', () => {
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('SUBSCRIPTION')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('ETHUSDC')
      );
      done();
    });

    client.connect();
    mockWs.emit('open');
  });

  test('should handle orderbook messages', (done) => {
    client.on('orderbook', (tick) => {
      expect(tick.symbol).toBe('ETHUSDC');
      expect(tick.bidPrice).toBe(2000);
      expect(tick.askPrice).toBe(2001);
      expect(tick.bidQty).toBe(1);
      expect(tick.askQty).toBe(2);
      done();
    });

    client.connect();
    mockWs.emit('open');

    const message = {
      c: 'spot@public.deals.v3.api@ETHUSDC',
      d: {
        bids: [['2000', '1']],
        asks: [['2001', '2']]
      }
    };

    mockWs.emit('message', JSON.stringify(message));
  });

  test('should handle trade messages', (done) => {
    client.on('trade', (tick) => {
      expect(tick.symbol).toBe('ETHUSDC');
      expect(tick.price).toBe(2000.5);
      expect(tick.qty).toBe(0.1);
      expect(tick.side).toBe('BUY');
      done();
    });

    client.connect();
    mockWs.emit('open');

    const message = {
      c: 'spot@public.deals.v3.api@ETHUSDC',
      d: [{
        p: '2000.5',
        q: '0.1',
        T: 1,
        t: Date.now()
      }]
    };

    mockWs.emit('message', JSON.stringify(message));
  });

  test('should handle connection errors', (done) => {
    client.on('error', (error) => {
      expect(error).toBeDefined();
      done();
    });

    client.connect();
    mockWs.emit('error', new Error('Connection failed'));
  });

  test('should handle disconnection', (done) => {
    client.on('disconnected', () => {
      expect(client.isConnectedToWebSocket()).toBe(false);
      done();
    });

    client.connect();
    mockWs.emit('open');
    mockWs.emit('close', 1000, 'Normal closure');
  });

  test('should send ping messages', (done) => {
    client.connect();
    mockWs.emit('open');

    setTimeout(() => {
      expect(mockWs.ping).toHaveBeenCalled();
      done();
    }, 100);
  });

  test('should handle malformed messages gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    client.connect();
    mockWs.emit('open');
    mockWs.emit('message', 'invalid json');

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('should disconnect cleanly', () => {
    client.connect();
    mockWs.emit('open');
    
    client.disconnect();
    
    expect(mockWs.close).toHaveBeenCalled();
    expect(client.isConnectedToWebSocket()).toBe(false);
  });
});
