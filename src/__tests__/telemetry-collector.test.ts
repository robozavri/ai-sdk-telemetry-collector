import { AITelemetryCollector } from '../telemetry-collector';
import { TelemetryConfig } from '../types';

// Mock fetch for testing
global.fetch = jest.fn();

describe('AITelemetryCollector', () => {
  let collector: AITelemetryCollector;
  let mockConfig: TelemetryConfig;

  beforeEach(() => {
    mockConfig = {
      serverUrl: 'https://test-server.com',
      debug: true,
    };
    collector = new AITelemetryCollector(mockConfig);
  });

  afterEach(async () => {
    await collector.destroy();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      expect(collector).toBeInstanceOf(AITelemetryCollector);
      expect(collector.getConfig().batchSize).toBe(10);
      expect(collector.getConfig().batchTimeout).toBe(5000);
    });

    it('should merge custom config with defaults', () => {
      const customConfig: TelemetryConfig = {
        serverUrl: 'https://custom-server.com',
        batchSize: 25,
        batchTimeout: 15000,
      };
      const customCollector = new AITelemetryCollector(customConfig);
      
      expect(customCollector.getConfig().batchSize).toBe(25);
      expect(customCollector.getConfig().batchTimeout).toBe(15000);
      
      customCollector.destroy();
    });
  });

  describe('enable/disable', () => {
    it('should enable telemetry collection', () => {
      collector.enable();
      expect(collector.getStatus().enabled).toBe(true);
    });

    it('should disable telemetry collection', () => {
      collector.enable();
      collector.disable();
      expect(collector.getStatus().enabled).toBe(false);
    });

    it('should not enable twice', () => {
      collector.enable();
      collector.enable(); // Second call should be ignored
      expect(collector.getStatus().enabled).toBe(true);
    });
  });

  describe('custom telemetry', () => {
    it('should send custom telemetry data', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, processed: 1 }),
      } as Response);

      await collector.sendCustomTelemetry({
        functionId: 'test-function',
        model: { id: 'test-model', provider: 'test' },
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        metadata: { test: true },
      });

      // Wait for batch processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      const newConfig = { batchSize: 20, debug: false };
      collector.updateConfig(newConfig);
      
      const currentConfig = collector.getConfig();
      expect(currentConfig.batchSize).toBe(20);
      expect(currentConfig.debug).toBe(false);
    });

    it('should return current configuration', () => {
      const config = collector.getConfig();
      expect(config.serverUrl).toBe(mockConfig.serverUrl);
      expect(config.batchSize).toBe(10); // default value
    });
  });

  describe('status', () => {
    it('should return correct status', () => {
      const status = collector.getStatus();
      expect(status.enabled).toBe(false);
      expect(typeof status.isConnected).toBe('boolean');
    });
  });
});
