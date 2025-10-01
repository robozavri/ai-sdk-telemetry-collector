# Complete Usage Guide

## Two Ways to Use This Package

The `@robozavri/ai-sdk-telemetry-collector` package offers two approaches to automatic telemetry collection. **Both capture identical telemetry data** - choose based on your preference and environment.

## 🎯 Approach 1: Auto-Instrumentation (Recommended for Simplicity)

### Overview

The simplest possible usage - just **2 lines of setup code**, then use AI SDK functions normally. The package automatically intercepts and instruments all AI SDK calls.

### Quick Start

```typescript
import { AITelemetryCollector } from '@robozavri/ai-sdk-telemetry-collector';

// Setup (do once at app startup)
const collector = new AITelemetryCollector({
  serverUrl: 'http://localhost:3001/analytics/telemetry',
  apiKey: process.env.TELEMETRY_API_KEY,
  debug: true,
});

collector.enable();

// That's it! Now use AI SDK normally...
```

### Complete Example

```typescript
// lib/telemetry.ts
import { AITelemetryCollector } from '@robozavri/ai-sdk-telemetry-collector';

export const collector = new AITelemetryCollector({
  serverUrl: process.env.TELEMETRY_SERVER_URL!,
  apiKey: process.env.TELEMETRY_API_KEY,
  debug: process.env.NODE_ENV === 'development',
});

// Enable once at startup
collector.enable();
```

```typescript
// app/api/chat/route.ts
import { streamText } from 'ai';  // Import normally
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Use streamText normally - NO wrapping needed!
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

// ✨ Telemetry is captured automatically!
```

### How It Works

When you call `collector.enable()`, the package:
1. Locates the `ai` module in Node's require cache
2. Replaces `streamText`, `generateText`, `streamObject` with instrumented versions
3. All subsequent calls automatically capture telemetry
4. Works transparently - your code doesn't change

### Pros & Cons

**Pros:**
- ✅ Absolute simplest usage - just 2 lines
- ✅ No wrapping needed
- ✅ Works with existing code
- ✅ Zero changes to AI SDK calls

**Cons:**
- ⚠️ Requires the `ai` module to be loadable at startup
- ⚠️ May not work in some Edge Runtime environments
- ⚠️ Less explicit control over what's instrumented

### When to Use

- ✅ Node.js environments
- ✅ Standard Next.js App Router
- ✅ You want the simplest possible setup
- ✅ You trust automatic module interception

---

## 🎛️ Approach 2: Explicit Wrapping (Recommended for Control)

### Overview

More explicit control - you wrap the AI SDK functions you want to instrument. This gives you fine-grained control and works in all environments.

### Quick Start

```typescript
import { streamText } from 'ai';
import { AITelemetryCollector } from '@robozavri/ai-sdk-telemetry-collector';

// Setup
const telemetry = new AITelemetryCollector({
  serverUrl: 'https://your-server.com',
});

telemetry.enable();

// Wrap once
const wrappedStreamText = telemetry.wrap(streamText);

// Use wrapped version
const result = await wrappedStreamText({ /* ... */ });
```

### Complete Example

```typescript
// lib/telemetry.ts
import { AITelemetryCollector } from '@robozavri/ai-sdk-telemetry-collector';
import { streamText, generateText, streamObject } from 'ai';

export const telemetry = new AITelemetryCollector({
  serverUrl: process.env.TELEMETRY_SERVER_URL!,
  apiKey: process.env.TELEMETRY_API_KEY,
});

telemetry.enable();

// Export wrapped versions
export const wrappedStreamText = telemetry.wrap(streamText);
export const wrappedGenerateText = telemetry.wrap(generateText);
export const wrappedStreamObject = telemetry.wrap(streamObject);
```

```typescript
// app/api/chat/route.ts
import { wrappedStreamText } from '@/lib/telemetry';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Use wrapped version
  const result = await wrappedStreamText({
    model: openai('gpt-4o'),
    messages,
  });

  return result.toDataStreamResponse();
}
```

### How It Works

1. You call `telemetry.wrap(streamText)` which returns an instrumented version
2. The wrapped function intercepts calls and captures telemetry
3. Returns the exact same result as the original function
4. Completely transparent to your application logic

### Pros & Cons

**Pros:**
- ✅ Works in all environments (Node, Edge, etc.)
- ✅ Explicit control over what's instrumented
- ✅ Easy to debug
- ✅ Clear in code what's being tracked

**Cons:**
- ⚠️ Requires wrapping each function
- ⚠️ Need to use wrapped versions everywhere
- ⚠️ Slightly more setup code

### When to Use

- ✅ Edge Runtime environments
- ✅ You want explicit control
- ✅ Auto-instrumentation doesn't work in your environment
- ✅ You only want to instrument specific functions

---

## Comparison

| Feature | Auto-Instrumentation | Explicit Wrapping |
|---------|---------------------|-------------------|
| **Setup Code** | 2 lines | 3-5 lines per function |
| **Code Changes** | None | Use wrapped versions |
| **Control** | Automatic | Explicit |
| **Edge Runtime** | May not work | Always works |
| **Debugging** | Less visible | More visible |
| **Best For** | Simplicity | Control & compatibility |

---

## Configuration (Both Approaches)

Both approaches use the same configuration:

```typescript
const collector = new AITelemetryCollector({
  // Required
  serverUrl: 'https://your-server.com/api/telemetry',
  
  // Optional
  apiKey: 'your-api-key',
  debug: true,
  
  // Content Capture
  capturePrompts: true,
  captureResponses: true,
  captureSystemPrompt: true,
  maxContentLength: 10000,
  
  // Privacy
  redactSensitiveData: false,
  
  // Batching
  batchSize: 10,
  batchTimeout: 5000,
});
```

---

## Custom Metadata (Both Approaches)

Add custom tracking data using `experimental_telemetry`:

```typescript
const result = await streamText({  // or wrappedStreamText
  model: openai('gpt-4'),
  messages,
  experimental_telemetry: {
    isEnabled: true,
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

This works identically in both approaches.

---

## Which Approach Should You Use?

### Use Auto-Instrumentation If:
- You want the absolute simplest setup
- You're in a standard Node.js/Next.js environment
- You don't need fine-grained control
- You're comfortable with automatic module interception

### Use Explicit Wrapping If:
- You're in an Edge Runtime environment
- You want explicit control over instrumentation
- You only want to track specific functions
- You prefer code that's easy to debug and understand

### Or Use Both!

You can actually use both approaches together:

```typescript
// Enable auto-instrumentation as a baseline
collector.enable();

// But also explicitly wrap for critical functions you want to ensure are tracked
const wrappedCriticalFunction = collector.wrap(streamText);
```

---

## Testing Your Setup

### Check Status

```typescript
console.log(collector.getStatus());
// { enabled: true, isConnected: true, aiSdkIntegration: true }
```

### Enable Debug Mode

```typescript
const collector = new AITelemetryCollector({
  serverUrl: 'https://your-server.com',
  debug: true,  // See detailed logs
});
```

### Verify Data is Being Sent

Check your server logs to confirm telemetry batches are being received.

---

## Examples

See the `examples/` directory for complete working examples:

- **`auto-instrumentation-example.ts`** - Auto-instrumentation approach
- **`wrapper-example.ts`** - Explicit wrapping approach

---

## Summary

Both approaches capture **identical telemetry data**:
- Prompts and responses
- Token usage
- Performance metrics
- Model information
- Custom metadata
- Everything!

Choose based on your preference:
- **Simple**: Auto-instrumentation (2 lines)
- **Control**: Explicit wrapping (more visible)

The package is flexible and works both ways! 🎉
