# AI SDK Telemetry Collector

A Node.js package for collecting and forwarding telemetry data from Vercel AI SDK to remote servers. This package intercepts OpenTelemetry spans from AI SDK operations and provides comprehensive analytics data including token usage, performance metrics, tool usage, and more.

## Features

- 🔍 **Automatic Telemetry Collection**: Intercepts AI SDK OpenTelemetry spans automatically
- 📊 **Rich Analytics Data**: Collects token usage, performance metrics, tool usage, and custom metadata
- 🚀 **Efficient Batching**: Batches telemetry data for optimal performance
- 🔄 **Retry Logic**: Built-in retry mechanism with exponential backoff
- 🛡️ **Error Handling**: Robust error handling and connection management
- 📈 **Real-time Monitoring**: Monitor AI operations in real-time
- 🔧 **Configurable**: Flexible configuration options for different use cases

## Installation

```bash
npm install @your-org/ai-sdk-telemetry-collector
```

## Quick Start

### Basic Usage

```typescript
import { AITelemetryCollector } from '@your-org/ai-sdk-telemetry-collector';

// Initialize the collector
const collector = new AITelemetryCollector({
  serverUrl: 'https://your-analytics-server.com',
  apiKey: 'your-api-key', // optional
  debug: true, // enable debug logging
});

// Enable telemetry collection
collector.enable();

// Your AI SDK code will now automatically send telemetry data
```

### With Vercel AI SDK

```typescript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { AITelemetryCollector } from '@your-org/ai-sdk-telemetry-collector';

// Initialize collector
const collector = new AITelemetryCollector({
  serverUrl: 'https://your-analytics-server.com',
  debug: true,
});

// Enable collection
collector.enable();

// Your AI SDK calls will now be monitored
const result = streamText({
  model: openai('gpt-4'),
  system: 'You are a helpful assistant',
  messages: [{ role: 'user', content: 'Hello!' }],
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'chat-assistant',
    metadata: {
      userId: 'user-123',
      sessionId: 'session-456',
    },
  },
});
```

## Configuration Options

```typescript
interface TelemetryConfig {
  serverUrl: string;                    // Remote server URL
  apiKey?: string;                      // API key for authentication
  batchSize?: number;                   // Batch size (default: 10)
  batchTimeout?: number;                // Batch timeout in ms (default: 5000)
  debug?: boolean;                      // Enable debug logging
  headers?: Record<string, string>;     // Custom headers
  retry?: {
    maxAttempts: number;                // Max retry attempts (default: 3)
    delayMs: number;                    // Base delay in ms (default: 1000)
  };
}
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

- `enable()`: Enable telemetry collection
- `disable()`: Disable telemetry collection
- `sendCustomTelemetry(data)`: Send custom telemetry data
- `getConfig()`: Get current configuration
- `updateConfig(config)`: Update configuration
- `getStatus()`: Get collection status
- `destroy()`: Cleanup resources

#### Properties

- `enabled`: Whether collection is enabled
- `isConnected`: Connection status to remote server

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

1. **Telemetry not being collected**
   - Ensure `collector.enable()` is called
   - Check that AI SDK has `experimental_telemetry` enabled
   - Verify OpenTelemetry is properly configured

2. **Connection failures**
   - Check server URL and network connectivity
   - Verify API key if authentication is required
   - Check server logs for errors

3. **Missing data**
   - Ensure spans are being generated by AI SDK
   - Check debug logs for processing errors
   - Verify span attributes contain expected data

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
const collector = new AITelemetryCollector({
  serverUrl: 'https://your-server.com',
  debug: true, // This will log detailed information
});
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

### v1.0.0
- Initial release
- Basic telemetry collection
- Batching and retry logic
- Comprehensive data extraction
