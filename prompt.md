I asked AI:

see the doc: @https://ai-sdk.dev/docs/ai-sdk-core/telemetry 
the part: experimental_telemetry.
I want to use my code to send analytics data to my server.
What data does it provide and what can be taken for analytics?
Is it streaming or a one-time call?
Tell me a plan for what can be done.
I want to send the experimental_telemetry to my other server, so that I can get the analytical data that Martvi tracker will give us at the first stage.

Looking at the AI SDK telemetry documentation and your current code, I can help you understand how to implement analytics data collection. Let me first examine your current chat route to see how you're using `streamText`.

AI answerd this:

[1 tool called]

Now let me check if there are any existing telemetry or analytics implementations in your codebase:


[1 tool called]

Based on the AI SDK telemetry documentation and your existing codebase, I can provide you with a comprehensive plan for implementing analytics data collection. Let me analyze what's available and what you can do.

## What AI SDK Telemetry Provides

The AI SDK telemetry provides rich analytics data through OpenTelemetry spans and events. For your `streamText` function, you'll get:

### **Key Data Points Available:**

1. **Performance Metrics:**
   - `ai.response.msToFirstChunk` - Time to first response chunk
   - `ai.response.msToFinish` - Total completion time
   - `ai.response.avgCompletionTokensPerSecond` - Generation speed

2. **Usage Analytics:**
   - `ai.usage.completionTokens` - Output tokens consumed
   - `ai.usage.promptTokens` - Input tokens consumed
   - Total token usage per request

3. **Model Information:**
   - `ai.model.id` - Model used (e.g., "gpt-5-mini")
   - `ai.model.provider` - Provider (e.g., "openai")
   - `ai.response.model` - Actual model that responded

4. **Request Details:**
   - `ai.prompt` - The system prompt and user messages
   - `ai.settings.maxOutputTokens` - Token limits
   - `ai.settings.maxRetries` - Retry configuration

5. **Tool Usage:**
   - `ai.toolCall` spans for each tool execution
   - Tool names, arguments, and results
   - Tool execution timing

## Implementation Plan

### **Phase 1: Enable AI SDK Telemetry**

```typescript:src/app/api/chat/route.ts
// ... existing code ...
const result = streamText({
  model: openai('gpt-5-mini'),
  system: `You are an Umami Analytics Assistant...`,
  messages: [...convertToModelMessages(messages)],
  stopWhen: stepCountIs(5),
  tools: toolsAny as any,
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'umami-chat-assistant',
    metadata: {
      websiteId: 'your-website-id', // Add if available
      userId: 'user-id', // Add if available
      sessionId: 'session-id', // Add if available
    },
    recordInputs: true, // Set to false if you want to exclude prompts
    recordOutputs: true, // Set to false if you want to exclude responses
  },
});
```

### **Phase 2: Create Custom Telemetry Collector**

Create a new file to intercept and forward telemetry data:

```typescript:src/lib/ai-telemetry.ts
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

interface TelemetryData {
  functionId: string;
  modelId: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  msToFirstChunk?: number;
  msToFinish?: number;
  avgTokensPerSecond?: number;
  toolCalls: Array<{
    name: string;
    duration: number;
    success: boolean;
  }>;
  metadata: Record<string, any>;
  timestamp: string;
}

class AITelemetryCollector {
  private serverUrl: string;
  private batchSize: number = 10;
  private batchTimeout: number = 5000;
  private batch: TelemetryData[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
    this.setupBatchProcessing();
  }

  private setupBatchProcessing() {
    // Process batch every 5 seconds or when batch is full
    this.batchTimer = setInterval(() => {
      this.flushBatch();
    }, this.batchTimeout);
  }

  async collectTelemetry(span: any, metadata: Record<string, any> = {}) {
    try {
      const telemetryData: TelemetryData = {
        functionId: span.attributes['ai.telemetry.functionId'] || 'unknown',
        modelId: span.attributes['ai.model.id'] || 'unknown',
        provider: span.attributes['ai.model.provider'] || 'unknown',
        promptTokens: span.attributes['ai.usage.promptTokens'] || 0,
        completionTokens: span.attributes['ai.usage.completionTokens'] || 0,
        totalTokens: (span.attributes['ai.usage.promptTokens'] || 0) + 
                    (span.attributes['ai.usage.completionTokens'] || 0),
        msToFirstChunk: span.attributes['ai.response.msToFirstChunk'],
        msToFinish: span.attributes['ai.response.msToFinish'],
        avgTokensPerSecond: span.attributes['ai.response.avgCompletionTokensPerSecond'],
        toolCalls: [], // Will be populated from tool call spans
        metadata,
        timestamp: new Date().toISOString(),
      };

      this.batch.push(telemetryData);
      
      if (this.batch.length >= this.batchSize) {
        this.flushBatch();
      }
    } catch (error) {
      console.error('Error collecting telemetry:', error);
    }
  }

  private async flushBatch() {
    if (this.batch.length === 0) return;

    const batchToSend = [...this.batch];
    this.batch = [];

    try {
      await fetch(`${this.serverUrl}/api/ai-telemetry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batch: batchToSend,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Error sending telemetry batch:', error);
      // Optionally retry failed batches
    }
  }

  destroy() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    this.flushBatch();
  }
}

export const aiTelemetryCollector = new AITelemetryCollector(
  process.env.AI_TELEMETRY_SERVER_URL || 'http://localhost:3001'
);
```

### **Phase 3: Create API Endpoint for Telemetry**

```typescript:src/app/api/ai-telemetry/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { batch, timestamp } = await request.json();
    
    // Store in your database or forward to external analytics service
    console.log('Received AI telemetry batch:', { batchSize: batch.length, timestamp });
    
    // Example: Store in ClickHouse (since you already use it)
    // await storeAITelemetry(batch);
    
    // Example: Forward to external service
    // await forwardToExternalService(batch);
    
    return NextResponse.json({ success: true, received: batch.length });
  } catch (error) {
    console.error('Error processing AI telemetry:', error);
    return NextResponse.json({ error: 'Failed to process telemetry' }, { status: 500 });
  }
}
```

### **Phase 4: Integration with Existing Analytics**

Since you already have a comprehensive analytics system, you can:

1. **Extend your existing event tracking** to include AI interactions
2. **Create new metrics** for AI performance monitoring
3. **Build dashboards** showing AI usage patterns

### **Phase 5: Advanced Analytics Dashboard**

Create new components to visualize AI analytics:

```typescript:src/components/metrics/AIAnalyticsChart.tsx
// New component for AI analytics visualization
// Similar to your existing EventsChart and WebsiteChart components
```

## **Key Benefits of This Approach:**

1. **Real-time Monitoring**: Track AI performance as it happens
2. **Cost Optimization**: Monitor token usage and optimize prompts
3. **Performance Insights**: Identify slow responses and bottlenecks
4. **Tool Usage Analytics**: See which tools are most/least used
5. **User Experience**: Track response times and quality
6. **Business Intelligence**: Understand AI usage patterns

## **Data Flow:**

```
AI SDK → OpenTelemetry → Custom Collector → Batch Processing → Your Server → Database/Analytics
```

## **Privacy & Security Considerations:**

- Set `recordInputs: false` if prompts contain sensitive data
- Set `recordOutputs: false` if responses contain sensitive information
- Implement data retention policies
- Consider GDPR compliance for user data

This implementation will give you comprehensive analytics similar to what Martvi tracker provides, but specifically tailored to your AI chat assistant's performance and usage patterns.


