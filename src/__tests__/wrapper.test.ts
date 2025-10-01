import { AITelemetryCollector } from '../telemetry-collector';
import { AITelemetryData } from '../types';

/**
 * Comprehensive tests for the automatic wrapper functionality
 */
describe('AITelemetryCollector - Automatic Wrapper', () => {
  let collector: AITelemetryCollector;
  let mockServerUrl: string;
  let capturedTelemetry: AITelemetryData[] = [];

  beforeEach(() => {
    // Reset captured data
    capturedTelemetry = [];
    mockServerUrl = 'http://localhost:3000/api/telemetry';

    // Mock fetch globally
    global.fetch = jest.fn().mockImplementation(async (url: string, options?: any) => {
      const body = options?.body ? JSON.parse(options.body) : null;
      if (body?.events) {
        capturedTelemetry.push(...body.events);
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, processed: body?.events?.length || 0 }),
      };
    });

    // Initialize collector
    collector = new AITelemetryCollector({
      serverUrl: mockServerUrl,
      debug: true,
      batchSize: 1, // Send immediately for testing
      batchTimeout: 100,
    });

    collector.enable();
  });

  afterEach(async () => {
    await collector.destroy();
    jest.clearAllMocks();
  });

  describe('wrap() method', () => {
    it('should expose a wrap() method on AITelemetryCollector', () => {
      expect(collector.wrap).toBeDefined();
      expect(typeof collector.wrap).toBe('function');
    });

    it('should return a function when wrapping a function', () => {
      const mockAIFunction = jest.fn();
      const wrapped = collector.wrap(mockAIFunction);
      expect(typeof wrapped).toBe('function');
    });
  });

  describe('streamText wrapper', () => {
    it('should automatically capture telemetry for streamText', async () => {
      // Mock streamText function
      const mockStreamText = jest.fn().mockResolvedValue({
        text: 'Hello, world!',
        usage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        },
        toDataStreamResponse: () => ({
          body: new ReadableStream(),
        }),
      });

      // Wrap the function
      const wrappedStreamText = collector.wrap(mockStreamText);

      // Call the wrapped function
      const result = await wrappedStreamText({
        model: { id: 'gpt-4', provider: 'openai' },
        messages: [{ role: 'user', content: 'Hello!' }],
      });

      // Verify the original function was called
      expect(mockStreamText).toHaveBeenCalledTimes(1);

      // Verify result is returned unchanged
      expect(result).toBeDefined();
      expect(result.text).toBe('Hello, world!');

      // Wait for telemetry to be sent
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify telemetry was captured
      expect(capturedTelemetry.length).toBeGreaterThan(0);
      const telemetry = capturedTelemetry[0];
      expect(telemetry.model.id).toBe('gpt-4');
      expect(telemetry.usage.totalTokens).toBe(15);
    });

    it('should capture prompt content when enabled', async () => {
      const mockStreamText = jest.fn().mockResolvedValue({
        text: 'Response',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        toDataStreamResponse: () => ({ body: new ReadableStream() }),
      });

      const wrappedStreamText = collector.wrap(mockStreamText);

      await wrappedStreamText({
        model: { id: 'gpt-4', provider: 'openai' },
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'What is the weather?' },
        ],
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(capturedTelemetry.length).toBeGreaterThan(0);
      const telemetry = capturedTelemetry[0];
      expect(telemetry.metadata.prompt).toBe('What is the weather?');
      expect(telemetry.metadata.systemPrompt).toBe('You are a helpful assistant');
    });

    it('should respect capturePrompts config option', async () => {
      // Create collector with capturePrompts disabled
      const noPromptCollector = new AITelemetryCollector({
        serverUrl: mockServerUrl,
        capturePrompts: false,
        batchSize: 1,
      });
      noPromptCollector.enable();

      const mockStreamText = jest.fn().mockResolvedValue({
        text: 'Response',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        toDataStreamResponse: () => ({ body: new ReadableStream() }),
      });

      const wrappedStreamText = noPromptCollector.wrap(mockStreamText);

      await wrappedStreamText({
        model: { id: 'gpt-4', provider: 'openai' },
        messages: [{ role: 'user', content: 'Secret prompt' }],
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(capturedTelemetry.length).toBeGreaterThan(0);
      const telemetry = capturedTelemetry[0];
      expect(telemetry.metadata.prompt).toBeUndefined();

      await noPromptCollector.destroy();
    });

    it('should handle streaming responses with performance metrics', async () => {
      const mockStreamText = jest.fn().mockResolvedValue({
        text: 'Streaming response',
        usage: { promptTokens: 20, completionTokens: 30, totalTokens: 50 },
        toDataStreamResponse: () => ({ body: new ReadableStream() }),
      });

      const wrappedStreamText = collector.wrap(mockStreamText);

      const startTime = Date.now();
      await wrappedStreamText({
        model: { id: 'gpt-4', provider: 'openai' },
        messages: [{ role: 'user', content: 'Tell me a story' }],
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(capturedTelemetry.length).toBeGreaterThan(0);
      const telemetry = capturedTelemetry[0];
      expect(telemetry.performance).toBeDefined();
      expect(telemetry.performance.msToFinish).toBeGreaterThan(0);
    });
  });

  describe('generateText wrapper', () => {
    it('should automatically capture telemetry for generateText', async () => {
      const mockGenerateText = jest.fn().mockResolvedValue({
        text: 'Generated text response',
        usage: {
          promptTokens: 15,
          completionTokens: 25,
          totalTokens: 40,
        },
      });

      // Wrap with generateText in the name
      Object.defineProperty(mockGenerateText, 'name', { value: 'generateText' });
      const wrappedGenerateText = collector.wrap(mockGenerateText);

      const result = await wrappedGenerateText({
        model: { id: 'gpt-3.5-turbo', provider: 'openai' },
        messages: [{ role: 'user', content: 'Generate some text' }],
      });

      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      expect(result.text).toBe('Generated text response');

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(capturedTelemetry.length).toBeGreaterThan(0);
      const telemetry = capturedTelemetry[0];
      expect(telemetry.usage.totalTokens).toBe(40);
      expect(telemetry.model.id).toBe('gpt-3.5-turbo');
    });

    it('should capture response content for non-streaming functions', async () => {
      const mockGenerateText = jest.fn().mockResolvedValue({
        text: 'This is the generated response',
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      });

      Object.defineProperty(mockGenerateText, 'name', { value: 'generateText' });
      const wrappedGenerateText = collector.wrap(mockGenerateText);

      await wrappedGenerateText({
        model: { id: 'gpt-4', provider: 'openai' },
        messages: [{ role: 'user', content: 'Test' }],
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(capturedTelemetry.length).toBeGreaterThan(0);
      const telemetry = capturedTelemetry[0];
      expect(telemetry.metadata.response).toBe('This is the generated response');
    });
  });

  describe('streamObject wrapper', () => {
    it('should automatically capture telemetry for streamObject', async () => {
      const mockStreamObject = jest.fn().mockResolvedValue({
        object: { result: 'test' },
        usage: {
          promptTokens: 12,
          completionTokens: 8,
          totalTokens: 20,
        },
        toDataStreamResponse: () => ({ body: new ReadableStream() }),
      });

      Object.defineProperty(mockStreamObject, 'name', { value: 'streamObject' });
      const wrappedStreamObject = collector.wrap(mockStreamObject);

      const result = await wrappedStreamObject({
        model: { id: 'gpt-4', provider: 'openai' },
        messages: [{ role: 'user', content: 'Return an object' }],
      });

      expect(mockStreamObject).toHaveBeenCalledTimes(1);
      expect(result.object).toEqual({ result: 'test' });

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(capturedTelemetry.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should capture telemetry on errors', async () => {
      const mockStreamText = jest.fn().mockRejectedValue(new Error('API Error'));

      const wrappedStreamText = collector.wrap(mockStreamText);

      await expect(
        wrappedStreamText({
          model: { id: 'gpt-4', provider: 'openai' },
          messages: [{ role: 'user', content: 'Test' }],
        })
      ).rejects.toThrow('API Error');

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(capturedTelemetry.length).toBeGreaterThan(0);
      const telemetry = capturedTelemetry[0];
      expect(telemetry.metadata.error).toBe('API Error');
      expect(telemetry.metadata.errorType).toBe('Error');
    });

    it('should not break the original function flow on telemetry errors', async () => {
      // Mock fetch to fail
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const mockStreamText = jest.fn().mockResolvedValue({
        text: 'Success despite telemetry failure',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        toDataStreamResponse: () => ({ body: new ReadableStream() }),
      });

      const wrappedStreamText = collector.wrap(mockStreamText);

      // Should not throw even if telemetry fails
      const result = await wrappedStreamText({
        model: { id: 'gpt-4', provider: 'openai' },
        messages: [{ role: 'user', content: 'Test' }],
      });

      expect(result.text).toBe('Success despite telemetry failure');
    });
  });

  describe('metadata and settings', () => {
    it('should capture custom metadata from experimental_telemetry', async () => {
      const mockStreamText = jest.fn().mockResolvedValue({
        text: 'Response',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        toDataStreamResponse: () => ({ body: new ReadableStream() }),
      });

      const wrappedStreamText = collector.wrap(mockStreamText);

      await wrappedStreamText({
        model: { id: 'gpt-4', provider: 'openai' },
        messages: [{ role: 'user', content: 'Test' }],
        experimental_telemetry: {
          functionId: 'custom-chat-function',
          metadata: {
            userId: 'user-123',
            sessionId: 'session-456',
          },
        },
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(capturedTelemetry.length).toBeGreaterThan(0);
      const telemetry = capturedTelemetry[0];
      expect(telemetry.functionId).toBe('custom-chat-function');
      expect(telemetry.metadata.userId).toBe('user-123');
      expect(telemetry.metadata.sessionId).toBe('session-456');
    });

    it('should capture model settings', async () => {
      const mockGenerateText = jest.fn().mockResolvedValue({
        text: 'Response',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      });

      Object.defineProperty(mockGenerateText, 'name', { value: 'generateText' });
      const wrappedGenerateText = collector.wrap(mockGenerateText);

      await wrappedGenerateText({
        model: { id: 'gpt-4', provider: 'openai' },
        messages: [{ role: 'user', content: 'Test' }],
        temperature: 0.8,
        maxTokens: 2000,
        topP: 0.9,
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(capturedTelemetry.length).toBeGreaterThan(0);
      const telemetry = capturedTelemetry[0];
      expect(telemetry.settings.temperature).toBe(0.8);
      expect(telemetry.settings.maxOutputTokens).toBe(2000);
    });
  });

  describe('content redaction', () => {
    it('should redact sensitive data when enabled', async () => {
      const redactCollector = new AITelemetryCollector({
        serverUrl: mockServerUrl,
        redactSensitiveData: true,
        batchSize: 1,
      });
      redactCollector.enable();

      const mockStreamText = jest.fn().mockResolvedValue({
        text: 'Your email is user@example.com',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        toDataStreamResponse: () => ({ body: new ReadableStream() }),
      });

      const wrappedStreamText = redactCollector.wrap(mockStreamText);

      await wrappedStreamText({
        model: { id: 'gpt-4', provider: 'openai' },
        messages: [{ role: 'user', content: 'Contact me at admin@test.com' }],
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(capturedTelemetry.length).toBeGreaterThan(0);
      const telemetry = capturedTelemetry[0];
      expect(telemetry.metadata.prompt).toContain('[redacted-email]');
      expect(telemetry.metadata.prompt).not.toContain('admin@test.com');

      await redactCollector.destroy();
    });

    it('should truncate long content based on maxContentLength', async () => {
      const shortCollector = new AITelemetryCollector({
        serverUrl: mockServerUrl,
        maxContentLength: 50,
        batchSize: 1,
      });
      shortCollector.enable();

      const longText = 'A'.repeat(200);
      const mockStreamText = jest.fn().mockResolvedValue({
        text: 'Response',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        toDataStreamResponse: () => ({ body: new ReadableStream() }),
      });

      const wrappedStreamText = shortCollector.wrap(mockStreamText);

      await wrappedStreamText({
        model: { id: 'gpt-4', provider: 'openai' },
        messages: [{ role: 'user', content: longText }],
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(capturedTelemetry.length).toBeGreaterThan(0);
      const telemetry = capturedTelemetry[0];
      expect(telemetry.metadata.prompt).toBeDefined();
      expect(telemetry.metadata.prompt.length).toBeLessThanOrEqual(50);

      await shortCollector.destroy();
    });
  });

  describe('multiple wrapped functions', () => {
    it('should handle multiple different wrapped functions independently', async () => {
      const mockStreamText = jest.fn().mockResolvedValue({
        text: 'Stream response',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        toDataStreamResponse: () => ({ body: new ReadableStream() }),
      });

      const mockGenerateText = jest.fn().mockResolvedValue({
        text: 'Generate response',
        usage: { promptTokens: 8, completionTokens: 7, totalTokens: 15 },
      });

      Object.defineProperty(mockStreamText, 'name', { value: 'streamText' });
      Object.defineProperty(mockGenerateText, 'name', { value: 'generateText' });

      const wrappedStreamText = collector.wrap(mockStreamText);
      const wrappedGenerateText = collector.wrap(mockGenerateText);

      await wrappedStreamText({
        model: { id: 'gpt-4', provider: 'openai' },
        messages: [{ role: 'user', content: 'Stream' }],
      });

      await wrappedGenerateText({
        model: { id: 'gpt-3.5-turbo', provider: 'openai' },
        messages: [{ role: 'user', content: 'Generate' }],
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(capturedTelemetry.length).toBe(2);
      expect(mockStreamText).toHaveBeenCalledTimes(1);
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });
  });

  describe('integration with existing features', () => {
    it('should work when collector is enabled', () => {
      expect(collector.getStatus().enabled).toBe(true);
      const mockFunc = jest.fn();
      const wrapped = collector.wrap(mockFunc);
      expect(wrapped).toBeDefined();
    });

    it('should still work when collector is disabled', () => {
      collector.disable();
      expect(collector.getStatus().enabled).toBe(false);
      
      const mockFunc = jest.fn().mockResolvedValue({ text: 'test' });
      const wrapped = collector.wrap(mockFunc);
      expect(wrapped).toBeDefined();
    });
  });
});
