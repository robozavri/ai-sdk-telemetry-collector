/**
 * Example: Using the automatic wrapper functionality
 * 
 * This example demonstrates the simplest way to add telemetry to your
 * Vercel AI SDK functions using the wrapper approach.
 */

import { AITelemetryCollector } from '../src/index';

// Mock AI SDK functions for demonstration
// In a real app, these would come from 'ai' package:
// import { streamText, generateText } from 'ai';

/**
 * Mock streamText function (simulates Vercel AI SDK)
 */
async function mockStreamText(options: any) {
  return {
    text: 'This is a mock response from the AI',
    usage: {
      promptTokens: 15,
      completionTokens: 10,
      totalTokens: 25,
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
async function mockGenerateText(options: any) {
  return {
    text: 'This is a generated response',
    usage: {
      promptTokens: 20,
      completionTokens: 15,
      totalTokens: 35,
    },
    finishReason: 'stop',
  };
}

/**
 * Main example function
 */
async function main() {
  console.log('🚀 Wrapper Example: Automatic Telemetry Collection\n');

  // Step 1: Initialize the telemetry collector
  console.log('Step 1: Initialize telemetry collector');
  const telemetry = new AITelemetryCollector({
    serverUrl: 'http://localhost:3000/api/telemetry',
    apiKey: 'your-api-key',
    debug: true,
    capturePrompts: true,
    captureResponses: true,
    batchSize: 1, // Send immediately for demo
  });

  // Step 2: Enable the collector
  console.log('Step 2: Enable telemetry');
  telemetry.enable();

  console.log('Step 3: Check status');
  console.log('Status:', telemetry.getStatus());
  console.log('');

  // Step 3: Wrap your AI SDK functions
  console.log('Step 4: Wrap AI SDK functions');
  const instrumentedStreamText = telemetry.wrap(mockStreamText);
  const instrumentedGenerateText = telemetry.wrap(mockGenerateText);
  console.log('✅ Functions wrapped successfully\n');

  // Step 4: Use the wrapped functions normally
  console.log('Step 5: Using wrapped streamText');
  try {
    const streamResult = await instrumentedStreamText({
      model: { id: 'gpt-4', provider: 'openai' },
      messages: [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'What is the capital of France?' },
      ],
      temperature: 0.7,
      maxTokens: 100,
    });
    console.log('✅ streamText result:', streamResult.text);
  } catch (error) {
    console.error('❌ Error:', error);
  }

  console.log('');

  // Step 5: Use generateText with custom metadata
  console.log('Step 6: Using wrapped generateText with metadata');
  try {
    const generateResult = await instrumentedGenerateText({
      model: { id: 'gpt-3.5-turbo', provider: 'openai' },
      messages: [
        { role: 'user', content: 'Tell me a joke' },
      ],
      experimental_telemetry: {
        functionId: 'joke-generator',
        metadata: {
          userId: 'user-123',
          sessionId: 'session-456',
          feature: 'joke-generation',
        },
      },
    });
    console.log('✅ generateText result:', generateResult.text);
  } catch (error) {
    console.error('❌ Error:', error);
  }

  // Give time for telemetry to be sent
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Step 6: Cleanup
  console.log('\nStep 7: Cleanup');
  await telemetry.destroy();
  console.log('✅ Telemetry collector destroyed\n');

  console.log('📊 Summary:');
  console.log('- Wrapped 2 AI SDK functions');
  console.log('- Made 2 AI calls');
  console.log('- All telemetry was automatically captured and sent');
  console.log('- No manual tracking code required! 🎉');
}

/**
 * Real-world usage example with Next.js
 */
function nextjsExample() {
  console.log('\n📘 Next.js App Router Example:\n');

  const exampleCode = `
// lib/telemetry.ts
import { AITelemetryCollector } from '@robozavri/ai-sdk-telemetry-collector';
import { streamText, generateText } from 'ai';

export const telemetry = new AITelemetryCollector({
  serverUrl: process.env.TELEMETRY_SERVER_URL!,
  apiKey: process.env.TELEMETRY_API_KEY,
  debug: process.env.NODE_ENV === 'development',
});

telemetry.enable();

// Export wrapped functions
export const wrappedStreamText = telemetry.wrap(streamText);
export const wrappedGenerateText = telemetry.wrap(generateText);

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
  `;

  console.log(exampleCode);
}

/**
 * Privacy-focused example
 */
function privacyExample() {
  console.log('\n🔒 Privacy-Focused Example:\n');

  const exampleCode = `
// Example: Capture only metrics, not content
const telemetry = new AITelemetryCollector({
  serverUrl: 'https://your-server.com',
  capturePrompts: false,      // Don't capture user prompts
  captureResponses: false,    // Don't capture AI responses
  captureSystemPrompt: false, // Don't capture system prompts
  // Still captures: token usage, performance, model info
});

// Example: Capture content but redact sensitive data
const telemetry = new AITelemetryCollector({
  serverUrl: 'https://your-server.com',
  redactSensitiveData: true,  // Redact emails, API keys, etc.
  maxContentLength: 5000,     // Limit content size
});
  `;

  console.log(exampleCode);
}

// Run the examples
if (require.main === module) {
  main()
    .then(() => {
      nextjsExample();
      privacyExample();
      console.log('\n✨ All examples completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error running examples:', error);
      process.exit(1);
    });
}

export { main, nextjsExample, privacyExample };
