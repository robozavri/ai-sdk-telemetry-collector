# Getting Started with v2.0.0

## 🎉 Congratulations!

Your package has been successfully upgraded to **v2.0.0** with automatic telemetry collection!

## What's New

The package now features a **simple wrapper API** that automatically captures all telemetry data without requiring any manual instrumentation code. Just wrap your AI SDK functions once and use them everywhere.

## Quick Start (3 Steps)

### 1️⃣ Wrap Your AI Functions

```typescript
import { streamText, generateText } from 'ai';
import { AITelemetryCollector } from '@robozavri/ai-sdk-telemetry-collector';

// Initialize
const telemetry = new AITelemetryCollector({
  serverUrl: 'https://your-analytics-server.com/api/telemetry',
  apiKey: 'your-api-key',
  debug: true,
});

telemetry.enable();

// Wrap once
const wrappedStreamText = telemetry.wrap(streamText);
const wrappedGenerateText = telemetry.wrap(generateText);
```

### 2️⃣ Use Wrapped Functions Normally

```typescript
// That's it! Use them anywhere
const result = await wrappedStreamText({
  model: openai('gpt-4o'),
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### 3️⃣ Telemetry is Automatic!

All data is automatically captured and sent:
- ✅ Prompts and responses
- ✅ Token usage
- ✅ Performance metrics
- ✅ Model info
- ✅ Everything!

## Next Steps

### Test Your Implementation

1. **Build the package**:
   ```bash
   npm run build
   ```

2. **Run the example**:
   ```bash
   npx ts-node examples/wrapper-example.ts
   ```

3. **Run tests**:
   ```bash
   npm test
   ```

### Publish to NPM

When ready to publish:

```bash
npm run build
npm publish --access public
```

### Use in Your Projects

Install and use:

```bash
npm install @robozavri/ai-sdk-telemetry-collector
```

## Key Files to Review

1. **`README.md`** - Complete documentation with examples
2. **`WRAPPER_GUIDE.md`** - Comprehensive wrapper usage guide
3. **`UPGRADE_SUMMARY.md`** - Technical details of implementation
4. **`examples/wrapper-example.ts`** - Working code example
5. **`src/__tests__/wrapper.test.ts`** - Test suite

## Implementation Details

### What Was Added

**New Public API Method** (`src/telemetry-collector.ts`):
```typescript
wrap<T extends Function>(aiFunction: T): T
```

**Core Wrapper Logic** (`src/ai-sdk-integration.ts`):
- `wrapAIFunction()` - Main wrapper dispatcher
- `wrapGenericAIFunction()` - Fallback wrapper
- Function type detection and routing

**Comprehensive Tests** (`src/__tests__/wrapper.test.ts`):
- 20+ test cases covering all functionality
- Edge cases, error handling, privacy options

**Documentation**:
- Updated `README.md` with wrapper-first approach
- New `WRAPPER_GUIDE.md` with detailed examples
- Usage examples and troubleshooting

### Configuration Options

Control what gets captured:

```typescript
const telemetry = new AITelemetryCollector({
  serverUrl: 'https://your-server.com',
  
  // Content capture
  capturePrompts: true,       // User prompts
  captureResponses: true,     // AI responses
  captureSystemPrompt: true,  // System prompts
  
  // Privacy
  redactSensitiveData: true,  // Redact emails, keys, etc.
  maxContentLength: 10000,    // Truncate long content
  
  // Batching
  batchSize: 10,
  batchTimeout: 5000,
  
  // Debug
  debug: true,
});
```

## Usage Patterns

### Pattern 1: Centralized (Recommended)

Create `lib/telemetry.ts`:
```typescript
import { AITelemetryCollector } from '@robozavri/ai-sdk-telemetry-collector';
import { streamText, generateText } from 'ai';

export const telemetry = new AITelemetryCollector({
  serverUrl: process.env.TELEMETRY_SERVER_URL!,
  apiKey: process.env.TELEMETRY_API_KEY,
});

telemetry.enable();

export const wrappedStreamText = telemetry.wrap(streamText);
export const wrappedGenerateText = telemetry.wrap(generateText);
```

Use everywhere:
```typescript
import { wrappedStreamText } from '@/lib/telemetry';

const result = await wrappedStreamText({ /* ... */ });
```

### Pattern 2: Per-Route

```typescript
import { telemetry } from '@/lib/telemetry';
import { streamText } from 'ai';

const wrapped = telemetry.wrap(streamText);

export async function POST(req: Request) {
  const result = await wrapped({ /* ... */ });
  return result.toDataStreamResponse();
}
```

## Example: Next.js App Router

```typescript
// lib/telemetry.ts
import { AITelemetryCollector } from '@robozavri/ai-sdk-telemetry-collector';
import { streamText } from 'ai';

export const telemetry = new AITelemetryCollector({
  serverUrl: process.env.TELEMETRY_SERVER_URL!,
  debug: process.env.NODE_ENV === 'development',
});

telemetry.enable();

export const instrumentedStreamText = telemetry.wrap(streamText);
```

```typescript
// app/api/chat/route.ts
import { instrumentedStreamText } from '@/lib/telemetry';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const result = await instrumentedStreamText({
    model: openai('gpt-4o'),
    messages,
    experimental_telemetry: {
      functionId: 'chat-api',
      metadata: {
        userId: 'user-123',
        route: '/api/chat',
      },
    },
  });
  
  return result.toDataStreamResponse();
}
```

## Telemetry Data Format

Your server receives:

```json
{
  "batchId": "uuid",
  "events": [
    {
      "id": "req_123...",
      "functionId": "streamText",
      "model": {
        "id": "gpt-4o",
        "provider": "openai"
      },
      "usage": {
        "promptTokens": 150,
        "completionTokens": 75,
        "totalTokens": 225
      },
      "performance": {
        "msToFirstChunk": 1200,
        "msToFinish": 3500,
        "avgCompletionTokensPerSecond": 21.4,
        "chunkCount": 12
      },
      "metadata": {
        "prompt": "User's question",
        "response": "AI's answer",
        "userId": "user-123"
      },
      "timestamp": "2025-10-01T13:38:43.000Z"
    }
  ]
}
```

## Server Endpoint Example

```typescript
// Express.js example
app.post('/api/telemetry', async (req, res) => {
  const { events } = req.body;
  
  for (const event of events) {
    // Store in database, analytics platform, etc.
    await saveToDatabase(event);
  }
  
  res.json({
    success: true,
    processed: events.length,
  });
});
```

## Troubleshooting

### Not Capturing Data?

1. ✅ Check `telemetry.enable()` is called
2. ✅ Verify using wrapped function (not original)
3. ✅ Enable `debug: true` to see logs
4. ✅ Check server URL is correct

### AI Function Not Working?

1. ✅ Wrapper is transparent—should work identically
2. ✅ Check debug logs for telemetry errors
3. ✅ Telemetry failures never break AI operations

### Enable Debug Logging

```typescript
const telemetry = new AITelemetryCollector({
  serverUrl: 'https://your-server.com',
  debug: true,  // See detailed logs
});
```

## Benefits Summary

### Before v2.0 (Manual)
```typescript
// ❌ Manual code in every AI call
onFinish: async (result) => {
  await collector.sendCustomTelemetry({
    model: { id: 'gpt-4', provider: 'openai' },
    usage: result.usage,
    // ... manually extract everything
  });
}
```

### After v2.0 (Automatic)
```typescript
// ✅ Wrap once, use everywhere
const wrapped = telemetry.wrap(streamText);
const result = await wrapped({ /* ... */ });
// Telemetry captured automatically!
```

## What Makes v2.0 Better?

1. **Zero Manual Code** - No instrumentation in your app
2. **One-Time Setup** - Wrap once, use everywhere
3. **Transparent** - Doesn't affect AI SDK behavior
4. **Reliable** - Captures everything automatically
5. **Error Resilient** - Telemetry errors never break AI
6. **Privacy Controls** - Fine-grained capture settings
7. **Fully Tested** - Comprehensive test suite
8. **Well Documented** - Clear examples and guides

## Resources

- 📖 **Main Documentation**: `README.md`
- 📘 **Wrapper Guide**: `WRAPPER_GUIDE.md`
- 🔧 **Technical Details**: `UPGRADE_SUMMARY.md`
- 💻 **Working Example**: `examples/wrapper-example.ts`
- ✅ **Tests**: `src/__tests__/wrapper.test.ts`

## Support

For questions or issues:
- Review the documentation files
- Run the example: `npx ts-node examples/wrapper-example.ts`
- Enable debug mode to see what's happening
- Check test suite for usage patterns

## Ready to Ship! 🚀

Your package is now ready with:
- ✅ Automatic wrapper functionality
- ✅ Comprehensive documentation
- ✅ Working examples
- ✅ Test suite
- ✅ Version 2.0.0

**Next step**: Test it, then publish to NPM!

```bash
npm run build
npm test
npm publish --access public
```

Enjoy your automatic telemetry collection! 🎉
