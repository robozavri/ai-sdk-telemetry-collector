# Automatic AI SDK Integration

This document describes the new automatic AI SDK integration feature that eliminates the need for manual telemetry collection in the `@robozavri/ai-sdk-telemetry-collector` package.

## 🎯 Overview

The automatic integration feature automatically hooks into AI SDK operations (`streamText`, `generateText`, `streamObject`) and collects telemetry data without requiring manual `sendCustomTelemetry()` calls.

## 🚀 Key Features

- **Zero Configuration**: Works out of the box with default settings
- **Automatic Instrumentation**: Hooks into AI SDK functions transparently
- **Stream Monitoring**: Tracks streaming response metrics (first chunk time, chunk count)
- **Error Handling**: Automatically captures and reports errors
- **Manual Control**: Can be enabled/disabled at runtime
- **Custom Configuration**: Supports custom function IDs and metadata

## 📦 Installation

```bash
npm install @robozavri/ai-sdk-telemetry-collector
```

## 🔧 Basic Usage

### Automatic Integration (Recommended)

```typescript
import { AITelemetryCollector } from '@robozavri/ai-sdk-telemetry-collector';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

// Initialize collector - AI SDK integration is automatic
const collector = new AITelemetryCollector({
  serverUrl: 'http://localhost:3001',
  apiKey: 'your-api-key',
  debug: true,
  enableAISDKIntegration: true, // This is the default
});

collector.enable();

// Use AI SDK normally - telemetry is collected automatically
const result = await streamText({
  model: openai('gpt-4o'),
  messages: [{ role: 'user', content: 'Hello!' }],
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'chat-assistant',
    metadata: {
      userId: 'user-123',
      sessionId: 'session-456'
    }
  }
});

// Telemetry is automatically collected when the stream finishes
return result.toDataStreamResponse();
```

### Manual Control

```typescript
// Disable automatic integration
collector.disableAISDKIntegration();

// Enable automatic integration
collector.enableAISDKIntegration();

// Check if AI SDK integration is enabled
const status = collector.getStatus();
console.log('AI SDK Integration:', status.aiSdkIntegration);
```

## ⚙️ Configuration Options

```typescript
interface TelemetryConfig {
  // ... existing options
  enableAISDKIntegration?: boolean;  // Default: true
  autoDetectAI?: boolean;           // Default: true
  aiFunctionId?: string;            // Default function ID
  aiMetadata?: Record<string, any>; // Default metadata
}
```

### Example Configuration

```typescript
const collector = new AITelemetryCollector({
  serverUrl: 'http://localhost:3001',
  apiKey: 'your-api-key',
  debug: true,
  enableAISDKIntegration: true,
  autoDetectAI: true,
  aiFunctionId: 'my-custom-function',
  aiMetadata: {
    environment: 'production',
    version: '1.0.0',
    region: 'us-east-1'
  }
});
```

## 📊 Supported AI SDK Functions

### streamText
```typescript
const result = await streamText({
  model: openai('gpt-4o'),
  messages: [{ role: 'user', content: 'Hello!' }],
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'streaming-chat',
    metadata: { sessionId: 'session-123' }
  }
});

// Telemetry collected automatically on stream completion
return result.toDataStreamResponse();
```

### generateText
```typescript
const result = await generateText({
  model: openai('gpt-4o'),
  messages: [{ role: 'user', content: 'Write a poem' }],
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'poem-generator',
    metadata: { style: 'haiku' }
  }
});

// Telemetry collected automatically on completion
console.log(result.text);
```

### streamObject
```typescript
const result = await streamObject({
  model: openai('gpt-4o'),
  messages: [{ role: 'user', content: 'Create a user profile' }],
  schema: UserSchema,
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'user-profile-generator',
    metadata: { outputType: 'structured' }
  }
});

// Telemetry collected automatically on completion
console.log(result.object);
```

## 📈 Collected Telemetry Data

The automatic integration collects comprehensive telemetry data:

```typescript
interface AITelemetryData {
  id: string;
  functionId: string;
  model: {
    id: string;
    provider: string;
  };
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  performance: {
    msToFirstChunk?: number;    // For streaming responses
    msToFinish?: number;
    avgCompletionTokensPerSecond?: number;
    chunkCount?: number;        // For streaming responses
  };
  tools: Array<{
    name: string;
    duration: number;
    success: boolean;
    arguments?: any;
    result?: any;
  }>;
  settings: {
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  };
  metadata: Record<string, any>;
  timestamp: string;
  spanContext: {
    traceId: string;
    spanId: string;
  };
}
```

## 🔍 Monitoring and Debugging

### Debug Mode
```typescript
const collector = new AITelemetryCollector({
  serverUrl: 'http://localhost:3001',
  debug: true, // Enables detailed logging
  enableAISDKIntegration: true
});
```

### Status Monitoring
```typescript
const status = collector.getStatus();
console.log('Status:', {
  enabled: status.enabled,
  isConnected: status.isConnected,
  aiSdkIntegration: status.aiSdkIntegration
});
```

### Connection Testing
```typescript
const isHealthy = await collector.testConnection();
console.log('Server health:', isHealthy);
```

## 🧪 Testing

### Test Script
```typescript
import { testAISDKIntegration } from './test-automatic-integration';

// Run integration tests
await testAISDKIntegration();
```

### Example Usage
```typescript
import { runAllExamples } from './examples/automatic-integration-example';

// Run comprehensive examples
await runAllExamples();
```

## 🚨 Error Handling

The automatic integration includes comprehensive error handling:

- **Network Errors**: Automatic retry with exponential backoff
- **AI SDK Errors**: Captured and reported in telemetry
- **Integration Errors**: Graceful fallback without breaking AI operations
- **Configuration Errors**: Clear error messages and logging

## 🔄 Migration from Manual Integration

### Before (Manual)
```typescript
const result = await streamText({...});

// Manual telemetry collection required
result.onFinish(async (result) => {
  await collector.sendCustomTelemetry({
    functionId: 'chat-assistant',
    model: { id: 'gpt-4o', provider: 'openai' },
    usage: result.usage,
    // ... other data
  });
});
```

### After (Automatic)
```typescript
const result = await streamText({...});

// Telemetry collected automatically - no manual calls needed!
return result.toDataStreamResponse();
```

## 🎯 Best Practices

1. **Enable Debug Mode**: Use `debug: true` during development
2. **Custom Function IDs**: Use descriptive function IDs for better tracking
3. **Metadata**: Include relevant context in metadata
4. **Error Monitoring**: Monitor telemetry server for errors
5. **Performance**: Use batching for high-volume applications

## 🔧 Troubleshooting

### Common Issues

1. **Integration Not Working**
   - Check if `enableAISDKIntegration` is `true`
   - Verify AI SDK is installed and accessible
   - Check debug logs for error messages

2. **Missing Telemetry Data**
   - Ensure `experimental_telemetry.isEnabled` is `true`
   - Check network connectivity to telemetry server
   - Verify API key and server URL

3. **Performance Issues**
   - Adjust `batchSize` and `batchTimeout` settings
   - Monitor memory usage with high-volume applications
   - Consider disabling integration for non-critical operations

### Debug Commands

```typescript
// Check integration status
console.log('AI SDK Integration:', collector.isAISDKIntegrationEnabled());

// Check configuration
console.log('Config:', collector.getConfig());

// Test connection
const isHealthy = await collector.testConnection();
console.log('Server Health:', isHealthy);
```

## 📚 API Reference

### AITelemetryCollector

#### Methods
- `enableAISDKIntegration()`: Enable automatic AI SDK integration
- `disableAISDKIntegration()`: Disable automatic AI SDK integration
- `isAISDKIntegrationEnabled()`: Check if integration is enabled
- `getStatus()`: Get current status including AI SDK integration state

#### Configuration
- `enableAISDKIntegration`: Enable/disable automatic integration
- `autoDetectAI`: Auto-detect AI SDK functions
- `aiFunctionId`: Default function ID for AI operations
- `aiMetadata`: Default metadata for AI operations

## 🎉 Conclusion

The automatic AI SDK integration feature makes telemetry collection seamless and effortless. Simply initialize the collector and use AI SDK functions normally - telemetry data is collected automatically without any manual intervention required.

For more examples and advanced usage, see the `examples/` directory in the package.
