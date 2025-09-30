/**
 * 🚀 TINY EXAMPLE: Automatic Content Capture
 * Just 3 lines - captures ALL prompts and responses automatically!
 */

import { AITelemetryCollectorEnhanced } from './src/telemetry-collector-enhanced';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

async function tinyContentCaptureExample() {
  // 1. Initialize enhanced collector (content capture is automatic by default)
  const collector = new AITelemetryCollectorEnhanced({
    serverUrl: 'http://localhost:3001',
    debug: true
  });

  // 2. Enable telemetry collection (content capture happens automatically)
  collector.enable();

  // 3. Use AI SDK normally - ALL CONTENT is captured automatically!
  const result = await streamText({
    model: openai('gpt-4o'),
    messages: [
      { 
        role: 'system', 
        content: 'You are a helpful coding assistant. Always provide clear examples.' 
      },
      { 
        role: 'user', 
        content: 'How do I create a React component with hooks?' 
      }
    ],
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'react-help'
    }
  });

  // That's it! ALL CONTENT is automatically captured when stream finishes:
  // ✅ System prompt: "You are a helpful coding assistant..."
  // ✅ User prompt: "How do I create a React component with hooks?"
  // ✅ AI response: Complete streaming response content
  // ✅ Performance metrics: Timing, chunk count, etc.
  // ✅ Usage statistics: Token counts
  // ✅ Custom metadata: Function ID, etc.

  return result.toDataStreamResponse();
}

// Run the example
tinyContentCaptureExample().then(() => {
  console.log('✅ Tiny content capture example completed!');
  console.log('📊 Check your telemetry server for ALL captured content!');
}).catch(console.error);

export { tinyContentCaptureExample };
