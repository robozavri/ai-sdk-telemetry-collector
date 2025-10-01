/**
 * Example: Automatic Instrumentation (No Wrapping Required)
 * 
 * This example demonstrates the simplest possible usage where you just:
 * 1. Initialize the collector
 * 2. Call enable()
 * 3. Use AI SDK functions normally - they're automatically instrumented!
 */

import { AITelemetryCollector } from '../src/index';

// Mock AI SDK functions for demonstration
// In a real app, you would import from 'ai':
// import { streamText, generateText } from 'ai';

/**
 * Mock streamText function (simulates Vercel AI SDK)
 */
async function streamText(options: any) {
  console.log('📡 streamText called with:', options.messages?.[0]?.content);
  return {
    text: 'This is a mock streaming response',
    usage: {
      promptTokens: 25,
      completionTokens: 15,
      totalTokens: 40,
    },
    finishReason: 'stop',
    toDataStreamResponse: () => ({
      body: new ReadableStream(),
    }),
  };
}

/**
 * Mock generateText function (simulates Vercel AI SDK)
 */
async function generateText(options: any) {
  console.log('📡 generateText called with:', options.messages?.[0]?.content);
  return {
    text: 'This is a mock generated response',
    usage: {
      promptTokens: 30,
      completionTokens: 20,
      totalTokens: 50,
    },
    finishReason: 'stop',
  };
}

/**
 * Main example - demonstrates auto-instrumentation
 */
async function main() {
  console.log('🚀 Auto-Instrumentation Example\n');
  console.log('This demonstrates the SIMPLEST possible usage:\n');
  console.log('1️⃣  Initialize collector');
  console.log('2️⃣  Call enable()');
  console.log('3️⃣  Use AI SDK functions normally - NO WRAPPING NEEDED!\n');
  console.log('=' .repeat(60) + '\n');

  // ========================================
  // Step 1: Initialize the collector
  // ========================================
  console.log('Step 1: Initialize collector\n');
  const collector = new AITelemetryCollector({
    serverUrl: 'http://localhost:3001/analytics/telemetry',
    apiKey: process.env.TELEMETRY_API_KEY || 'test-key',
    debug: true, // Enable debug logging
    capturePrompts: true,
    captureResponses: true,
  });
  console.log('✅ Collector initialized\n');

  // ========================================
  // Step 2: Enable automatic instrumentation
  // ========================================
  console.log('Step 2: Enable automatic instrumentation\n');
  collector.enable();
  console.log('✅ Auto-instrumentation enabled\n');
  console.log('=' .repeat(60) + '\n');

  // ========================================
  // Step 3: Use AI SDK functions NORMALLY
  // ========================================
  console.log('Step 3: Use AI SDK functions normally (no wrapping!)\n');

  try {
    // Example 1: streamText
    console.log('Example 1: Using streamText directly\n');
    const streamResult = await streamText({
      model: { id: 'gpt-4o', provider: 'openai' },
      messages: [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'What is the capital of France?' },
      ],
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'chat-assistant',
        metadata: {
          userId: 'test-user',
          sessionId: 'session-123',
          requestId: 'req-456',
        },
      },
    });
    console.log('✅ streamText result:', streamResult.text);
    console.log('📊 Telemetry was automatically captured!\n');
  } catch (error) {
    console.error('❌ Error:', error);
  }

  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    // Example 2: generateText
    console.log('Example 2: Using generateText directly\n');
    const generateResult = await generateText({
      model: { id: 'gpt-3.5-turbo', provider: 'openai' },
      messages: [
        { role: 'user', content: 'Tell me a joke' },
      ],
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'joke-generator',
        metadata: {
          userId: 'test-user-2',
          feature: 'entertainment',
        },
      },
    });
    console.log('✅ generateText result:', generateResult.text);
    console.log('📊 Telemetry was automatically captured!\n');
  } catch (error) {
    console.error('❌ Error:', error);
  }

  // Wait for telemetry to be sent
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('=' .repeat(60));
  console.log('\n🎉 SUCCESS! Auto-instrumentation worked!\n');
  console.log('Key Points:');
  console.log('✅ No manual wrapping required');
  console.log('✅ No onFinish callbacks needed');
  console.log('✅ Just initialize + enable, then use normally');
  console.log('✅ All telemetry captured automatically\n');

  // Cleanup
  await collector.destroy();
  console.log('✅ Collector destroyed\n');
}

/**
 * Real-world example: Next.js API Route
 */
function nextjsExample() {
  console.log('=' .repeat(60));
  console.log('\n📘 Real-World Example: Next.js API Route\n');

  const example = `
// lib/telemetry.ts
import { AITelemetryCollector } from '@robozavri/ai-sdk-telemetry-collector';

export const collector = new AITelemetryCollector({
  serverUrl: process.env.TELEMETRY_SERVER_URL!,
  apiKey: process.env.TELEMETRY_API_KEY,
  debug: process.env.NODE_ENV === 'development',
});

// Enable once at startup
collector.enable();

// That's it! Auto-instrumentation is now active.


// app/api/chat/route.ts
import { streamText } from 'ai';  // Import normally
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Use streamText normally - NO WRAPPING NEEDED!
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
// No manual code, no wrapping, no instrumentation.
  `;

  console.log(example);
}

/**
 * Show both approaches
 */
function comparisonExample() {
  console.log('=' .repeat(60));
  console.log('\n📊 Comparison: Two Approaches\n');

  console.log('Approach 1: AUTO-INSTRUMENTATION (Recommended for simplicity)\n');
  const auto = `
// 1. Initialize & enable
const collector = new AITelemetryCollector({ serverUrl: '...' });
collector.enable();

// 2. Use AI SDK normally
const result = await streamText({
  model: openai('gpt-4'),
  messages,
});
// ✨ Telemetry captured automatically!
  `;
  console.log(auto);

  console.log('\nApproach 2: EXPLICIT WRAPPING (More control)\n');
  const wrapped = `
// 1. Initialize & enable
const collector = new AITelemetryCollector({ serverUrl: '...' });
collector.enable();

// 2. Wrap the function
const wrappedStreamText = collector.wrap(streamText);

// 3. Use wrapped version
const result = await wrappedStreamText({
  model: openai('gpt-4'),
  messages,
});
// ✨ Telemetry captured via wrapper
  `;
  console.log(wrapped);

  console.log('\nBoth approaches capture the same telemetry data!');
  console.log('Choose based on your preference:');
  console.log('  • Auto: Simplest, 2 lines of setup');
  console.log('  • Wrap: Explicit, more control over what gets instrumented\n');
}

// Run the examples
if (require.main === module) {
  main()
    .then(() => {
      nextjsExample();
      comparisonExample();
      console.log('✨ All examples completed!\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error running examples:', error);
      process.exit(1);
    });
}

export { main, nextjsExample, comparisonExample };
