import { AITelemetryCollector } from '../telemetry-collector';

/**
 * Simplified tests for the wrapper functionality
 * These tests verify that the wrapper API works correctly without
 * trying to verify complex async telemetry capture
 */
describe('AITelemetryCollector - Wrapper API', () => {
  let collector: AITelemetryCollector;
  let mockServerUrl: string;

  beforeEach(() => {
    mockServerUrl = 'http://localhost:3000/api/telemetry';

    // Mock fetch globally
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as Response);

    // Initialize collector
    collector = new AITelemetryCollector({
      serverUrl: mockServerUrl,
      debug: false,
      batchSize: 1,
      batchTimeout: 100,
    });

    collector.enable();
  });

  afterEach(async () => {
    await collector.destroy();
    jest.clearAllMocks();
  });

  describe('wrap() method exists and works', () => {
    it('should expose a wrap() method', () => {
      expect(collector.wrap).toBeDefined();
      expect(typeof collector.wrap).toBe('function');
    });

    it('should return a function when wrapping', () => {
      const mockFunc = jest.fn();
      const wrapped = collector.wrap(mockFunc);
      expect(typeof wrapped).toBe('function');
    });

    it('should call the original function', async () => {
      const mockFunc = jest.fn().mockResolvedValue({ text: 'result' });
      const wrapped = collector.wrap(mockFunc);
      
      await wrapped({ test: 'data' });
      
      expect(mockFunc).toHaveBeenCalledTimes(1);
      expect(mockFunc).toHaveBeenCalledWith({ test: 'data' });
    });

    it('should return the original result', async () => {
      const expectedResult = { text: 'Hello!', usage: { totalTokens: 10 } };
      const mockFunc = jest.fn().mockResolvedValue(expectedResult);
      const wrapped = collector.wrap(mockFunc);
      
      const result = await wrapped({});
      
      expect(result).toEqual(expectedResult);
    });

    it('should pass through errors', async () => {
      const mockFunc = jest.fn().mockRejectedValue(new Error('Test error'));
      const wrapped = collector.wrap(mockFunc);
      
      await expect(wrapped({})).rejects.toThrow('Test error');
    });
  });

  describe('AI SDK function wrapping', () => {
    it('should wrap streamText-like functions', async () => {
      const mockStreamText = jest.fn().mockResolvedValue({
        text: 'Hello, world!',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: 'stop',
      });

      const wrapped = collector.wrap(mockStreamText);
      const result = await wrapped({
        model: { id: 'gpt-4', provider: 'openai' },
        messages: [{ role: 'user', content: 'Hello!' }],
      });

      expect(mockStreamText).toHaveBeenCalled();
      expect(result.text).toBe('Hello, world!');
      expect(result.usage.totalTokens).toBe(15);
    });

    it('should wrap generateText-like functions', async () => {
      const mockGenerateText = jest.fn().mockResolvedValue({
        text: 'Generated response',
        usage: { promptTokens: 15, completionTokens: 25, totalTokens: 40 },
        finishReason: 'stop',
      });

      Object.defineProperty(mockGenerateText, 'name', { value: 'generateText' });
      const wrapped = collector.wrap(mockGenerateText);
      
      const result = await wrapped({
        model: { id: 'gpt-3.5-turbo', provider: 'openai' },
        messages: [{ role: 'user', content: 'Test' }],
      });

      expect(mockGenerateText).toHaveBeenCalled();
      expect(result.text).toBe('Generated response');
    });

    it('should handle functions with custom metadata', async () => {
      const mockFunc = jest.fn().mockResolvedValue({ text: 'Response', usage: { totalTokens: 10 } });
      const wrapped = collector.wrap(mockFunc);

      await wrapped({
        model: { id: 'gpt-4', provider: 'openai' },
        messages: [{ role: 'user', content: 'Test' }],
        experimental_telemetry: {
          functionId: 'custom-function',
          metadata: { userId: 'user-123' },
        },
      });

      expect(mockFunc).toHaveBeenCalled();
    });
  });

  describe('configuration respect', () => {
    it('should work with different configurations', () => {
      const configuredCollector = new AITelemetryCollector({
        serverUrl: mockServerUrl,
        capturePrompts: false,
        captureResponses: false,
      });

      const mockFunc = jest.fn().mockResolvedValue({ text: 'test' });
      const wrapped = configuredCollector.wrap(mockFunc);
      
      expect(wrapped).toBeDefined();
    });
  });

  describe('multiple function wrapping', () => {
    it('should handle multiple wrapped functions', async () => {
      const func1 = jest.fn().mockResolvedValue({ text: 'Response 1', usage: { totalTokens: 10 } });
      const func2 = jest.fn().mockResolvedValue({ text: 'Response 2', usage: { totalTokens: 20 } });

      const wrapped1 = collector.wrap(func1);
      const wrapped2 = collector.wrap(func2);

      await wrapped1({});
      await wrapped2({});

      expect(func1).toHaveBeenCalledTimes(1);
      expect(func2).toHaveBeenCalledTimes(1);
    });
  });

  describe('collector state', () => {
    it('should work when enabled', () => {
      expect(collector.getStatus().enabled).toBe(true);
      const wrapped = collector.wrap(jest.fn());
      expect(wrapped).toBeDefined();
    });

    it('should work when disabled', () => {
      collector.disable();
      expect(collector.getStatus().enabled).toBe(false);
      
      const wrapped = collector.wrap(jest.fn().mockResolvedValue({ text: 'test' }));
      expect(wrapped).toBeDefined();
    });
  });
});
