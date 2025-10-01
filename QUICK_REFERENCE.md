# Quick Reference Card

## 🚀 Auto-Instrumentation (2 Lines - Your Preferred Method!)

```typescript
// Setup once
const collector = new AITelemetryCollector({
  serverUrl: 'http://localhost:3001/analytics/telemetry',
  apiKey: process.env.TELEMETRY_API_KEY || 'test-key',
  debug: true,
});

collector.enable();

// Use AI SDK normally - NO changes needed!
const result = await streamText({
  model: openai('gpt-4o'),
  messages: coreMessages,
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'chat-assistant',
    metadata: {
      userId: 'test-user',
      sessionId: sessionId,
      requestId: requestId,
    },
  },
});
```

✅ **That's it! Telemetry captured automatically**

---

## 🎛️ Explicit Wrapping (Alternative)

```typescript
// Setup
const telemetry = new AITelemetryCollector({
  serverUrl: 'https://your-server.com',
});

telemetry.enable();

// Wrap once
const wrappedStreamText = telemetry.wrap(streamText);

// Use wrapped version
const result = await wrappedStreamText({
  model: openai('gpt-4o'),
  messages,
});
```

---

## ⚙️ Common Configuration

```typescript
const collector = new AITelemetryCollector({
  serverUrl: 'https://your-server.com',     // Required
  apiKey: 'your-key',                       // Optional
  debug: true,                              // Optional
  capturePrompts: true,                     // Optional
  captureResponses: true,                   // Optional
  redactSensitiveData: false,               // Optional
  batchSize: 10,                            // Optional
  batchTimeout: 5000,                       // Optional
});
```

---

## 📊 What's Captured

- ✅ Prompts (user & system)
- ✅ Responses (complete text)
- ✅ Token usage (prompt, completion, total)
- ✅ Performance (time to first chunk, total time, tokens/sec)
- ✅ Model info (ID, provider)
- ✅ Settings (temperature, max tokens, etc.)
- ✅ Custom metadata
- ✅ Errors

---

## 🔒 Privacy Controls

```typescript
// Don't capture content, only metrics
const collector = new AITelemetryCollector({
  serverUrl: 'https://your-server.com',
  capturePrompts: false,
  captureResponses: false,
});

// Redact sensitive data
const collector = new AITelemetryCollector({
  serverUrl: 'https://your-server.com',
  redactSensitiveData: true,    // Redacts emails, API keys, etc.
  maxContentLength: 5000,        // Limit content size
});
```

---

## 🐛 Debugging

```typescript
const collector = new AITelemetryCollector({
  serverUrl: 'https://your-server.com',
  debug: true,  // Enable detailed logging
});

// Check status
console.log(collector.getStatus());
// { enabled: true, isConnected: true, aiSdkIntegration: true }
```

---

## 📝 Full Example (Next.js)

```typescript
// lib/telemetry.ts
import { AITelemetryCollector } from '@robozavri/ai-sdk-telemetry-collector';

export const collector = new AITelemetryCollector({
  serverUrl: process.env.TELEMETRY_SERVER_URL!,
  apiKey: process.env.TELEMETRY_API_KEY,
  debug: process.env.NODE_ENV === 'development',
});

collector.enable();
```

```typescript
// app/api/chat/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: openai('gpt-4o'),
    messages,
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'chat-api',
      metadata: {
        userId: 'user-123',
        sessionId: 'session-456',
      },
    },
  });

  return result.toDataStreamResponse();
}
```

---

## 📚 Documentation

- `README.md` - Main docs
- `USAGE_GUIDE.md` - Comparison of approaches
- `examples/auto-instrumentation-example.ts` - Working example

---

## ✨ Key Points

1. **Auto-instrumentation**: Just `collector.enable()` then use AI SDK normally
2. **Explicit wrapping**: `collector.wrap(streamText)` for more control
3. **Both work**: Choose based on preference
4. **Privacy controls**: Configure what to capture
5. **Error resilient**: Telemetry failures never break AI
6. **Zero changes**: Works with existing AI SDK code

---

**Package version: 2.0.0**
