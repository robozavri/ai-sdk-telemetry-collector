# Automatic Wrapper Guide

## Overview

Version 2.0.0 introduces **automatic telemetry collection** through a simple wrapper API. This eliminates the need for manual instrumentation—just wrap your AI SDK functions once and use them everywhere.

## Quick Start

### 1. Install the Package

```bash
npm install @robozavri/ai-sdk-telemetry-collector
```

### 2. Initialize and Wrap

```typescript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { AITelemetryCollector } from '@robozavri/ai-sdk-telemetry-collector';

// Initialize collector
const telemetry = new AITelemetryCollector({
  serverUrl: 'https://your-analytics-server.com/api/telemetry',
  debug: true,
});

telemetry.enable();

// Wrap the AI SDK function ONCE
const instrumentedStreamText = telemetry.wrap(streamText);

// Use it everywhere - telemetry is automatic!
const result = await instrumentedStreamText({
  model: openai('gpt-4o'),
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

## Key Features

### ✅ Automatic Data Collection

The wrapper automatically captures:
- **Prompts**: User messages, system prompts
- **Responses**: Complete AI-generated text
- **Token Usage**: Prompt, completion, and total tokens
- **Performance**: Time to first chunk, total time, tokens/second
- **Model Info**: Model ID and provider
- **Settings**: Temperature, max tokens, etc.
- **Errors**: Any errors that occur

### ✅ Zero Manual Work

**Before (v1.x - Manual):**
```typescript
const result = streamText({
  model: openai('gpt-4'),
  messages,
  onFinish: async (result) => {
    // Manual telemetry code
    await collector.sendCustomTelemetry({
      model: { id: 'gpt-4', provider: 'openai' },
      usage: result.usage,
      // ... manually extract all data
    });
  },
});
```

**After (v2.0 - Automatic):**
```typescript
const wrappedStreamText = telemetry.wrap(streamText);

const result = await wrappedStreamText({
  model: openai('gpt-4'),
  messages,
});
// ✨ Telemetry is captured automatically!
```

### ✅ Transparent Operation

The wrapper is completely transparent:
- Returns exact same result as the original function
- Doesn't affect function behavior
- Errors in telemetry never break your AI operations
- Zero performance overhead

## Usage Patterns

### Pattern 1: Centralized Setup (Recommended)

Create a centralized telemetry module:

```typescript
// lib/telemetry.ts
import { AITelemetryCollector } from '@robozavri/ai-sdk-telemetry-collector';
import { streamText, generateText, streamObject } from 'ai';

export const telemetry = new AITelemetryCollector({
  serverUrl: process.env.TELEMETRY_SERVER_URL!,
  apiKey: process.env.TELEMETRY_API_KEY,
  debug: process.env.NODE_ENV === 'development',
});

telemetry.enable();

// Export wrapped versions
export const wrappedStreamText = telemetry.wrap(streamText);
export const wrappedGenerateText = telemetry.wrap(generateText);
export const wrappedStreamObject = telemetry.wrap(streamObject);
```

Use in your application:

```typescript
// app/api/chat/route.ts
import { wrappedStreamText } from '@/lib/telemetry';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const result = await wrappedStreamText({
    model: openai('gpt-4o'),
    messages,
  });
  
  return result.toDataStreamResponse();
}
```

### Pattern 2: Per-Route Wrapping

Wrap functions at the route level:

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
  });
  
  return result.toDataStreamResponse();
}
```

### Pattern 3: Conditional Wrapping

Enable telemetry only in production:

```typescript
import { streamText } from 'ai';
import { telemetry } from '@/lib/telemetry';

// Wrap only in production
const aiStreamText = process.env.NODE_ENV === 'production' 
  ? telemetry.wrap(streamText)
  : streamText;

export async function POST(req: Request) {
  const result = await aiStreamText({
    model: openai('gpt-4o'),
    messages: [{ role: 'user', content: 'Hello!' }],
  });
  return result.toDataStreamResponse();
}
```

## Configuration

### Basic Configuration

```typescript
const telemetry = new AITelemetryCollector({
  serverUrl: 'https://your-server.com/api/telemetry',
  apiKey: 'your-api-key',
  debug: true,
});
```

### Content Control

```typescript
const telemetry = new AITelemetryCollector({
  serverUrl: 'https://your-server.com',
  capturePrompts: true,       // Capture user prompts (default: true)
  captureResponses: true,     // Capture AI responses (default: true)
  captureSystemPrompt: true,  // Capture system prompts (default: true)
  maxContentLength: 10000,    // Max characters per field (default: 10000)
});
```

### Privacy & Redaction

```typescript
const telemetry = new AITelemetryCollector({
  serverUrl: 'https://your-server.com',
  redactSensitiveData: true,  // Redact emails, API keys, etc.
  capturePrompts: false,      // Don't capture prompts at all
  captureResponses: false,    // Only capture metrics
});
```

### Batching

```typescript
const telemetry = new AITelemetryCollector({
  serverUrl: 'https://your-server.com',
  batchSize: 20,              // Send after 20 events
  batchTimeout: 10000,        // Or after 10 seconds
});
```

## Custom Metadata

Add custom tracking data to your AI calls:

```typescript
const result = await wrappedStreamText({
  model: openai('gpt-4'),
  messages: [{ role: 'user', content: 'Hello!' }],
  experimental_telemetry: {
    functionId: 'chat-assistant',
    metadata: {
      userId: 'user-123',
      sessionId: 'session-456',
      feature: 'chat',
      environment: 'production',
    },
  },
});
```

This metadata will be included in the telemetry data sent to your server.

## Supported Functions

The wrapper works with all Vercel AI SDK functions:

- ✅ `streamText` - Streaming text generation
- ✅ `generateText` - Non-streaming text generation  
- ✅ `streamObject` - Streaming structured output
- ✅ Any AI SDK function that follows the same pattern

## Error Handling

Telemetry errors **never break** your AI operations:

```typescript
// Even if telemetry server is down, your AI calls work normally
const result = await wrappedStreamText({
  model: openai('gpt-4'),
  messages: [{ role: 'user', content: 'Hello!' }],
});

// Result will be returned successfully
// Telemetry errors are logged (in debug mode) but don't throw
```

## Testing Your Setup

### 1. Enable Debug Mode

```typescript
const telemetry = new AITelemetryCollector({
  serverUrl: 'https://your-server.com',
  debug: true,  // See what's happening
});
```

### 2. Check Status

```typescript
console.log(telemetry.getStatus());
// { enabled: true, isConnected: true, aiSdkIntegration: true }
```

### 3. Make a Test Call

```typescript
const wrappedFunc = telemetry.wrap(streamText);
const result = await wrappedFunc({
  model: openai('gpt-4'),
  messages: [{ role: 'user', content: 'Test' }],
});
```

### 4. Verify Server Received Data

Check your server logs to confirm telemetry data was received.

## Telemetry Data Structure

Your server will receive data in this format:

```typescript
{
  batchId: "uuid",
  events: [
    {
      id: "req_123...",
      functionId: "streamText",
      model: {
        id: "gpt-4",
        provider: "openai"
      },
      usage: {
        promptTokens: 150,
        completionTokens: 75,
        totalTokens: 225
      },
      performance: {
        msToFirstChunk: 1200,
        msToFinish: 3500,
        avgCompletionTokensPerSecond: 21.4,
        chunkCount: 12
      },
      settings: {
        maxOutputTokens: 1000,
        temperature: 0.7
      },
      metadata: {
        prompt: "What is the capital of France?",
        systemPrompt: "You are a helpful assistant",
        response: "The capital of France is Paris.",
        userId: "user-123",        // From experimental_telemetry
        sessionId: "session-456"   // From experimental_telemetry
      },
      timestamp: "2025-10-01T13:38:43.000Z",
      spanContext: {
        traceId: "req_123...",
        spanId: "session_123..."
      }
    }
  ],
  timestamp: "2025-10-01T13:38:43.000Z",
  size: 1
}
```

## Server Implementation

Your server should accept POST requests at the configured endpoint:

```typescript
// Example Express.js endpoint
app.post('/api/telemetry', async (req, res) => {
  const { batchId, events, timestamp, size } = req.body;
  
  // Store or process telemetry events
  for (const event of events) {
    await saveTelemetry(event);
  }
  
  res.json({
    success: true,
    processed: events.length,
  });
});
```

## Migration from v1.x

If you're using v1.x with manual instrumentation:

**Old (v1.x):**
```typescript
const result = streamText({
  model: openai('gpt-4'),
  messages,
  onFinish: async (result) => {
    await collector.sendCustomTelemetry({
      // Manual data extraction...
    });
  },
});
```

**New (v2.0):**
```typescript
const wrappedStreamText = telemetry.wrap(streamText);
const result = await wrappedStreamText({
  model: openai('gpt-4'),
  messages,
});
// Done! No manual code needed
```

## Best Practices

1. **Wrap Once, Use Everywhere**: Wrap functions in a central location and export them
2. **Enable Debug Mode**: Use `debug: true` during development
3. **Configure Privacy**: Set appropriate `capturePrompts`, `captureResponses` flags
4. **Use Custom Metadata**: Add context like userId, sessionId for better analytics
5. **Monitor Your Server**: Ensure your telemetry server is receiving data
6. **Handle Secrets**: Don't hardcode API keys, use environment variables

## Troubleshooting

### Telemetry Not Working?

1. ✅ Check `telemetry.enable()` is called
2. ✅ Verify server URL is correct
3. ✅ Enable `debug: true` to see logs
4. ✅ Check network connectivity to server
5. ✅ Verify you're using the wrapped function

### AI Function Not Working?

1. ✅ Ensure you're passing correct arguments
2. ✅ Check that original function works without wrapper
3. ✅ Telemetry errors won't break AI—check debug logs

### Missing Data?

1. ✅ Check `capturePrompts`, `captureResponses` settings
2. ✅ Verify `maxContentLength` isn't truncating too much
3. ✅ Ensure AI SDK function returns expected structure

## Summary

Version 2.0.0 makes telemetry **completely automatic**:

1. Initialize `AITelemetryCollector`
2. Call `telemetry.enable()`
3. Wrap your AI functions with `telemetry.wrap()`
4. Use wrapped functions normally
5. ✨ Telemetry is captured automatically!

No manual instrumentation, no `onFinish` callbacks, no data extraction code. Just simple, transparent wrapping.

---

For more information, see the main [README.md](./README.md) or check the [examples](./examples/) directory.
