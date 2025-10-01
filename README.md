# AI SDK Telemetry Collector

A Node.js package for **automatic telemetry collection** from Vercel AI SDK. This package provides a simple wrapper that automatically captures all AI interactions including prompts, responses, token usage, performance metrics, and more—without requiring manual instrumentation.

## Features

- 🎯 **Automatic Instrumentation**: Wrap AI SDK functions once, use everywhere—no manual tracking needed
- 📊 **Comprehensive Data Collection**: Captures prompts, responses, token usage, performance metrics, tool calls, and metadata
- 🚀 **Zero-Overhead Design**: Transparent wrapper that doesn't affect your AI SDK functions
- 🔄 **Efficient Batching**: Batches telemetry data with configurable batch sizes and timeouts
- 🛡️ **Error Resilient**: Telemetry failures never break your AI operations
- 📈 **Real-time Monitoring**: Stream telemetry data to your analytics server in real-time
- 🔧 **Highly Configurable**: Control what data to capture, redact sensitive info, and more
- 🧪 **Fully Tested**: Comprehensive test suite ensures reliability

## Installation

```bash
npm install @robozavri/ai-sdk-telemetry-collector
```

## Quick Start

### Approach 1: Auto-Instrumentation (Simplest - 2 Lines!)

The absolute simplest way—just initialize and enable, then use AI SDK functions normally:

```typescript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { AITelemetryCollector } from '@robozavri/ai-sdk-telemetry-collector';

// 1. Initialize and enable (do this once at startup)
const collector = new AITelemetryCollector({
  serverUrl: 'https://your-analytics-server.com/api/telemetry',
  apiKey: 'your-api-key',
  debug: true,
});

collector.enable();

// 2. That's it! Now use AI SDK functions normally - NO wrapping needed!
export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const result = await streamText({
    model: openai('gpt-4o'),
    messages,
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'chat-assistant',
      metadata: {
        userId: 'user-123',
        sessionId: 'session-456',
      },
    },
  });
  
  return result.toDataStreamResponse();
}
```

✨ **Telemetry is captured automatically!** No wrapping, no manual code.

### Approach 2: Explicit Wrapping (More Control)

If you prefer explicit control or auto-instrumentation doesn't work in your environment:

```typescript
import { streamText } from 'ai';
import { AITelemetryCollector } from '@robozavri/ai-sdk-telemetry-collector';

// 1. Initialize and enable
const telemetry = new AITelemetryCollector({
  serverUrl: 'https://your-server.com/api/telemetry',
});

telemetry.enable();

// 2. Wrap your AI SDK functions
const wrappedStreamText = telemetry.wrap(streamText);

// 3. Use wrapped version
const result = await wrappedStreamText({
  model: openai('gpt-4o'),
  messages,
});
```

**Both approaches capture the same comprehensive telemetry data!**

### What Gets Captured Automatically

The wrapper automatically captures:
- ✅ **Prompts**: User messages and system prompts
- ✅ **Responses**: Complete AI-generated responses
- ✅ **Token Usage**: Prompt tokens, completion tokens, total tokens
- ✅ **Performance**: Time to first chunk, total generation time, tokens/second
- ✅ **Model Info**: Model ID, provider
- ✅ **Settings**: Temperature, max tokens, etc.
- ✅ **Metadata**: Custom metadata from `experimental_telemetry`
- ✅ **Errors**: Captures and logs any errors that occur

### With Custom Metadata

Add custom tracking metadata to your AI calls:

```typescript
const result = await instrumentedStreamText({
  model: openai('gpt-4'),
  messages: [{ role: 'user', content: 'Hello!' }],
  experimental_telemetry: {
    functionId: 'chat-assistant',
    metadata: {
      userId: 'user-123',
      sessionId: 'session-456',
      conversationId: 'conv-789',
    },
  },
});
```

### Multiple AI Functions

Wrap all your AI SDK functions:

```typescript
import { streamText, generateText, streamObject } from 'ai';

const instrumentedStreamText = telemetry.wrap(streamText);
const instrumentedGenerateText = telemetry.wrap(generateText);
const instrumentedStreamObject = telemetry.wrap(streamObject);

// Use them anywhere in your app
```

## Configuration Options

### Full Configuration

```typescript
const telemetry = new AITelemetryCollector({
  // Required
  serverUrl: 'https://your-server.com/api/telemetry',
  
  // Authentication (optional)
  apiKey: 'your-api-key',
  
  // Batching (optional)
  batchSize: 10,              // Number of events before sending (default: 10)
  batchTimeout: 5000,         // Max time in ms before sending (default: 5000)
  
  // Content Capture (optional)
  capturePrompts: true,       // Capture user prompts (default: true)
  captureResponses: true,     // Capture AI responses (default: true)
  captureSystemPrompt: true,  // Capture system prompts (default: true)
  maxContentLength: 10000,    // Max characters to capture (default: 10000)
  redactSensitiveData: false, // Redact emails, keys, etc. (default: false)
  
  // Debugging (optional)
  debug: true,                // Enable debug logging (default: false)
  
  // Custom headers (optional)
  headers: {
    'X-Custom-Header': 'value',
  },
  
  // Retry configuration (optional)
  retry: {
    maxAttempts: 3,           // Max retry attempts (default: 3)
    delayMs: 1000,            // Base delay between retries (default: 1000)
  },
});
```

### Privacy & Security Options

Control what data is captured:

```typescript
// Don't capture prompts or responses (only metadata and metrics)
const telemetry = new AITelemetryCollector({
  serverUrl: 'https://your-server.com',
  capturePrompts: false,
  captureResponses: false,
});

// Redact sensitive information
const telemetry = new AITelemetryCollector({
  serverUrl: 'https://your-server.com',
  redactSensitiveData: true,  // Redacts emails, API keys, credit card numbers
  maxContentLength: 5000,      // Limit content length
});
```

## Data Structure

The package collects comprehensive telemetry data:

### Core Metrics
- **Token Usage**: Prompt, completion, and total tokens
- **Performance**: Response times, tokens per second
- **Model Information**: Model ID, provider, response model
- **Tool Usage**: Tool names, execution times, success rates

### Example Telemetry Data

```typescript
{
  id: "uuid",
  functionId: "chat-assistant",
  model: {
    id: "gpt-4",
    provider: "openai",
    responseModel: "gpt-4-0613"
  },
  usage: {
    promptTokens: 150,
    completionTokens: 75,
    totalTokens: 225
  },
  performance: {
    msToFirstChunk: 1200,
    msToFinish: 3500,
    avgCompletionTokensPerSecond: 21.4
  },
  tools: [
    {
      name: "search_web",
      duration: 450,
      success: true
    }
  ],
  settings: {
    maxOutputTokens: 1000,
    temperature: 0.7
  },
  metadata: {
    userId: "user-123",
    sessionId: "session-456"
  },
  timestamp: "2024-01-15T10:30:00.000Z",
  spanContext: {
    traceId: "trace-123",
    spanId: "span-456"
  }
}
```

## API Reference

### AITelemetryCollector

#### Methods

- **`wrap<T>(aiFunction: T): T`**: Wrap an AI SDK function to automatically capture telemetry (recommended approach)
- **`enable()`**: Enable telemetry collection
- **`disable()`**: Disable telemetry collection
- **`sendCustomTelemetry(data)`**: Send custom telemetry data manually
- **`getConfig()`**: Get current configuration
- **`updateConfig(config)`**: Update configuration
- **`getStatus()`**: Get collection status (enabled, connected, etc.)
- **`destroy()`**: Cleanup resources and flush pending data

#### Key Properties

- `enabled`: Whether collection is enabled
- `isConnected`: Connection status to remote server

### Usage Examples

#### Basic Wrapper

```typescript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { telemetry } from './telemetry'; // Your telemetry instance

const wrappedStreamText = telemetry.wrap(streamText);

const result = await wrappedStreamText({
  model: openai('gpt-4'),
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

#### With Next.js App Router

```typescript
// app/api/chat/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { telemetry } from '@/lib/telemetry';

const instrumentedStreamText = telemetry.wrap(streamText);

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await instrumentedStreamText({
    model: openai('gpt-4o'),
    messages,
    experimental_telemetry: {
      functionId: 'chat-api',
      metadata: {
        route: '/api/chat',
        timestamp: Date.now(),
      },
    },
  });

  return result.toDataStreamResponse();
}
```

#### Centralized Setup

```typescript
// lib/telemetry.ts
import { AITelemetryCollector } from '@robozavri/ai-sdk-telemetry-collector';
import { streamText, generateText } from 'ai';

export const telemetry = new AITelemetryCollector({
  serverUrl: process.env.TELEMETRY_SERVER_URL!,
  apiKey: process.env.TELEMETRY_API_KEY,
  debug: process.env.NODE_ENV === 'development',
  capturePrompts: true,
  captureResponses: true,
});

telemetry.enable();

// Export wrapped functions
export const instrumentedStreamText = telemetry.wrap(streamText);
export const instrumentedGenerateText = telemetry.wrap(generateText);

// app/api/chat/route.ts
import { instrumentedStreamText } from '@/lib/telemetry';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = await instrumentedStreamText({
    model: openai('gpt-4o'),
    messages,
  });
  return result.toDataStreamResponse();
}
```

### TelemetrySender

#### Methods

- `sendTelemetry(data)`: Send telemetry data
- `forceFlush()`: Force flush current batch
- `testConnection()`: Test connection to remote server
- `getConnectionStatus()`: Get detailed connection status

## Advanced Usage

### Custom Telemetry Events

```typescript
// Send custom telemetry data
await collector.sendCustomTelemetry({
  functionId: 'custom-function',
  model: { id: 'custom-model', provider: 'custom' },
  usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
  metadata: { customField: 'customValue' }
});
```

### Batch Processing

```typescript
// Configure batch processing
const collector = new AITelemetryCollector({
  serverUrl: 'https://your-server.com',
  batchSize: 20,        // Send when 20 events collected
  batchTimeout: 10000,  // Or send every 10 seconds
});
```

### Error Handling

```typescript
// Check connection status
const status = collector.getStatus();
if (!status.isConnected) {
  console.log('Telemetry server connection failed');
}

// Test connection
const isConnected = await collector.sender.testConnection();
```

## Server Endpoints

Your remote server should implement these endpoints:

### POST /api/telemetry
Receives telemetry batches:

```typescript
{
  batchId: "uuid",
  events: [/* array of telemetry events */],
  timestamp: "2024-01-15T10:30:00.000Z",
  size: 10
}
```

### GET /health
Health check endpoint for connection testing.

## Performance Considerations

- **Batching**: Data is batched to reduce network overhead
- **Async Processing**: Telemetry collection doesn't block AI operations
- **Memory Management**: Automatic cleanup of processed spans
- **Connection Pooling**: Efficient HTTP connection management

## Security

- **API Key Authentication**: Secure communication with remote servers
- **Data Sanitization**: Sensitive data can be filtered out
- **HTTPS Support**: Secure transmission of telemetry data
- **Rate Limiting**: Built-in batching prevents overwhelming servers

## Troubleshooting

### Common Issues

1. **Telemetry not being captured**
   - ✅ Ensure `telemetry.enable()` is called before wrapping functions
   - ✅ Verify you're using the wrapped version of the AI SDK function
   - ✅ Check that your server URL is correct and reachable
   - ✅ Enable debug mode to see what's happening

2. **Connection failures**
   - ✅ Verify server URL is correct and accessible
   - ✅ Check API key if authentication is required
   - ✅ Ensure your server endpoint accepts POST requests
   - ✅ Check network connectivity and firewall rules

3. **Missing data in telemetry**
   - ✅ Check configuration options (`capturePrompts`, `captureResponses`, etc.)
   - ✅ Verify content isn't being truncated by `maxContentLength`
   - ✅ Ensure the AI SDK function is returning expected data structure
   - ✅ Look for errors in debug logs

4. **AI SDK functions not working after wrapping**
   - ✅ Ensure you're passing the correct AI SDK function to `wrap()`
   - ✅ Check that the wrapped function is being called with correct arguments
   - ✅ Telemetry errors should never break AI operations—check debug logs

### Debug Mode

Enable debug logging to see detailed information about what's happening:

```typescript
const telemetry = new AITelemetryCollector({
  serverUrl: 'https://your-server.com',
  debug: true, // Enable detailed logging
});
```

You'll see logs like:
```
[AITelemetryCollector] Telemetry collection enabled successfully
[AISDKIntegration] Wrapping unknown AI function: streamText, using generic wrapper
[AITelemetryCollector] Sending telemetry batch with 1 events
```

### Testing Your Setup

Test that telemetry is working:

```typescript
// 1. Create and enable collector
const telemetry = new AITelemetryCollector({
  serverUrl: 'https://your-server.com',
  debug: true,
});
telemetry.enable();

// 2. Check status
console.log(telemetry.getStatus());
// Output: { enabled: true, isConnected: true, aiSdkIntegration: true }

// 3. Test with a wrapped function
const mockResult = {
  text: 'test',
  usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
};
const wrappedFunc = telemetry.wrap(async () => mockResult);
await wrappedFunc({ model: { id: 'test' }, messages: [] });

// 4. Check server logs to verify data was received
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the examples

## Changelog

### v2.0.0 (Latest)
- ✨ **NEW**: Automatic wrapper functionality via `telemetry.wrap()` method
- ✨ **NEW**: Simple one-time wrapping—no manual instrumentation needed
- ✨ **NEW**: Comprehensive content capture (prompts, responses, system prompts)
- ✨ **NEW**: Privacy controls (redaction, content length limits, capture toggles)
- ✨ **NEW**: Full test suite for wrapper functionality
- 📚 Updated documentation with clear examples
- 🎯 Focus on developer experience and simplicity
- ⚡ Zero-overhead transparent wrapping
- 🛡️ Error resilience—telemetry failures never break AI operations

### v1.0.2
- Bug fixes and stability improvements
- Enhanced Edge Runtime support
- Improved error handling

### v1.0.0
- Initial release
- Basic telemetry collection via OpenTelemetry spans
- Batching and retry logic
- Manual instrumentation support
