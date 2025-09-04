import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { AITelemetryCollector } from '../src/index';

// Example: Integration with Vercel AI SDK
async function aiSdkIntegrationExample() {
  // Initialize telemetry collector
  const collector = new AITelemetryCollector({
    serverUrl: 'https://your-analytics-server.com',
    apiKey: process.env.TELEMETRY_API_KEY,
    debug: true,
    batchSize: 10,
    batchTimeout: 5000,
  });

  try {
    // Enable telemetry collection
    collector.enable();
    console.log('Telemetry collection enabled for AI SDK');

    // Example 1: Basic chat completion with telemetry
    console.log('\n--- Example 1: Basic Chat ---');
    const chatResult = await streamText({
      model: openai('gpt-4'),
      system: 'You are a helpful AI assistant. Keep responses concise.',
      messages: [
        { role: 'user', content: 'What is the capital of France?' }
      ],
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'basic-chat',
        metadata: {
          userId: 'user-123',
          sessionId: 'session-456',
          requestType: 'simple-question',
        },
      },
    });

    // Process the stream
    for await (const chunk of chatResult.textStream) {
      process.stdout.write(chunk);
    }
    console.log('\n');

    // Example 2: Chat with tools and telemetry
    console.log('\n--- Example 2: Chat with Tools ---');
    const toolResult = await streamText({
      model: openai('gpt-4'),
      system: 'You are a helpful assistant with access to tools.',
      messages: [
        { role: 'user', content: 'What is the current weather like?' }
      ],
      tools: {
        getWeather: {
          description: 'Get current weather information',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'The city and state, e.g. San Francisco, CA',
              },
            },
            required: ['location'],
          },
        },
      },
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'tool-chat',
        metadata: {
          userId: 'user-123',
          sessionId: 'session-456',
          requestType: 'tool-request',
          tools: ['getWeather'],
        },
      },
    });

    // Process the stream
    for await (const chunk of toolResult.textStream) {
      process.stdout.write(chunk);
    }
    console.log('\n');

    // Example 3: Multiple requests to show batching
    console.log('\n--- Example 3: Multiple Requests (Batching) ---');
    const promises = [];
    
    for (let i = 0; i < 5; i++) {
      const promise = streamText({
        model: openai('gpt-3.5-turbo'),
        system: 'You are a helpful assistant.',
        messages: [
          { role: 'user', content: `Request number ${i + 1}: Tell me a short joke.` }
        ],
        experimental_telemetry: {
          isEnabled: true,
          functionId: 'batch-test',
          metadata: {
            userId: 'user-123',
            sessionId: 'session-456',
            requestNumber: i + 1,
            batchTest: true,
          },
        },
      });
      
      promises.push(promise);
    }

    // Wait for all requests to complete
    const results = await Promise.all(promises);
    console.log(`Completed ${results.length} requests`);

    // Example 4: Custom telemetry for non-AI operations
    console.log('\n--- Example 4: Custom Telemetry ---');
    await collector.sendCustomTelemetry({
      functionId: 'user-interaction',
      model: { id: 'custom', provider: 'application' },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      metadata: {
        eventType: 'button-click',
        buttonId: 'submit-form',
        timestamp: Date.now(),
        userId: 'user-123',
      },
    });

    // Wait for batching to complete
    console.log('Waiting for telemetry batching...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Force flush any remaining data
    await collector.sender.forceFlush();
    console.log('Telemetry flush completed');

    // Show final status
    const status = collector.getStatus();
    const connectionStatus = collector.sender.getConnectionStatus();
    
    console.log('\n--- Final Status ---');
    console.log('Collection enabled:', status.enabled);
    console.log('Server connected:', status.isConnected);
    console.log('Connection status:', connectionStatus.status);
    console.log('Current batch size:', connectionStatus.batchSize);

  } catch (error) {
    console.error('Error in AI SDK integration example:', error);
  } finally {
    // Cleanup
    await collector.destroy();
    console.log('\nTelemetry collector destroyed');
  }
}

// Example: Environment-specific configuration
async function environmentSpecificExample() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const collector = new AITelemetryCollector({
    serverUrl: process.env.TELEMETRY_SERVER_URL || 'http://localhost:3001',
    apiKey: process.env.TELEMETRY_API_KEY,
    debug: !isProduction, // Only enable debug in non-production
    batchSize: isProduction ? 20 : 5, // Larger batches in production
    batchTimeout: isProduction ? 10000 : 3000, // Longer timeout in production
    retry: {
      maxAttempts: isProduction ? 5 : 3,
      delayMs: isProduction ? 2000 : 1000,
    },
  });

  collector.enable();

  // Your AI SDK code here...
  console.log('Environment-specific collector configured');

  await collector.destroy();
}

// Example: Error handling and monitoring
async function errorHandlingExample() {
  const collector = new AITelemetryCollector({
    serverUrl: 'https://invalid-server-url.com', // Invalid URL for testing
    debug: true,
    retry: {
      maxAttempts: 2,
      delayMs: 1000,
    },
  });

  collector.enable();

  try {
    // This will fail and trigger retry logic
    await collector.sender.testConnection();
  } catch (error) {
    console.log('Expected connection failure:', error.message);
  }

  // Check error status
  const connectionStatus = collector.sender.getConnectionStatus();
  console.log('Connection status after failure:', connectionStatus);

  await collector.destroy();
}

// Run examples
if (require.main === module) {
  console.log('Running AI SDK integration examples...\n');
  
  aiSdkIntegrationExample()
    .then(() => {
      console.log('\nAI SDK integration example completed');
      return environmentSpecificExample();
    })
    .then(() => {
      console.log('Environment-specific example completed');
      return errorHandlingExample();
    })
    .then(() => {
      console.log('Error handling example completed');
      console.log('\nAll examples completed successfully!');
    })
    .catch(console.error);
}

export { 
  aiSdkIntegrationExample, 
  environmentSpecificExample, 
  errorHandlingExample 
};
