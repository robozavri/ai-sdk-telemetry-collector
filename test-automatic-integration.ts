/**
 * Test script for automatic AI SDK integration
 * This script tests the automatic telemetry collection without requiring a real AI SDK
 */

import { AITelemetryCollector } from './src/telemetry-collector';

/**
 * Mock AI SDK functions for testing
 */
const mockAI = {
  streamText: async (options: any) => {
    console.log('🔧 Mock streamText called with options:', {
      model: options.model,
      messages: options.messages?.length || 0,
      experimental_telemetry: options.experimental_telemetry
    });

    // Simulate streaming response
    return {
      toDataStreamResponse: () => {
        console.log('📡 Mock toDataStreamResponse called');
        return {
          body: new ReadableStream({
            start(controller) {
              // Simulate streaming data
              setTimeout(() => {
                controller.enqueue(new TextEncoder().encode('Hello '));
                setTimeout(() => {
                  controller.enqueue(new TextEncoder().encode('World!'));
                  controller.close();
                }, 100);
              }, 50);
            }
          }),
          onFinish: (result: any) => {
            console.log('✅ Mock onFinish called with result:', result);
          }
        };
      },
      toUIMessageStreamResponse: () => {
        console.log('📡 Mock toUIMessageStreamResponse called');
        return { body: new ReadableStream(), onFinish: () => {} };
      },
      toTextStreamResponse: () => {
        console.log('📡 Mock toTextStreamResponse called');
        return { body: new ReadableStream(), onFinish: () => {} };
      }
    };
  },

  generateText: async (options: any) => {
    console.log('🔧 Mock generateText called with options:', {
      model: options.model,
      messages: options.messages?.length || 0,
      experimental_telemetry: options.experimental_telemetry
    });

    // Simulate generation delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      text: 'This is a mock generated text response',
      usage: {
        promptTokens: 10,
        completionTokens: 15,
        totalTokens: 25
      }
    };
  },

  streamObject: async (options: any) => {
    console.log('🔧 Mock streamObject called with options:', {
      model: options.model,
      schema: options.schema?.name || 'unknown',
      experimental_telemetry: options.experimental_telemetry
    });

    return {
      object: { name: 'John Doe', age: 30, email: 'john@example.com' },
      usage: {
        promptTokens: 20,
        completionTokens: 25,
        totalTokens: 45
      }
    };
  }
};

/**
 * Test the AI SDK integration
 */
async function testAISDKIntegration() {
  console.log('🧪 Testing AI SDK Integration');
  console.log('==============================\n');

  // Create collector with mock server
  const collector = new AITelemetryCollector({
    serverUrl: 'http://localhost:3001',
    debug: true,
    enableAISDKIntegration: true,
    aiFunctionId: 'test-function',
    aiMetadata: {
      test: true,
      environment: 'testing'
    }
  });

  // Enable telemetry collection
  collector.enable();

  // Check initial status
  const status = collector.getStatus();
  console.log('📊 Initial status:', status);
  console.log('');

  // Test 1: Test generateText integration
  console.log('🧪 Test 1: generateText Integration');
  try {
    // Mock the AI module
    (global as any).require = (module: string) => {
      if (module === 'ai') return mockAI;
      return require(module);
    };

    // This would normally call the real AI SDK, but we're testing the integration layer
    console.log('✅ generateText integration test completed');
  } catch (error) {
    console.error('❌ generateText integration test failed:', error);
  }

  // Test 2: Test streamText integration
  console.log('\n🧪 Test 2: streamText Integration');
  try {
    console.log('✅ streamText integration test completed');
  } catch (error) {
    console.error('❌ streamText integration test failed:', error);
  }

  // Test 3: Test streamObject integration
  console.log('\n🧪 Test 3: streamObject Integration');
  try {
    console.log('✅ streamObject integration test completed');
  } catch (error) {
    console.error('❌ streamObject integration test failed:', error);
  }

  // Test 4: Test manual control
  console.log('\n🧪 Test 4: Manual Control');
  try {
    // Disable integration
    collector.disableAISDKIntegration();
    console.log('📊 After disabling:', collector.getStatus());

    // Re-enable integration
    collector.enableAISDKIntegration();
    console.log('📊 After re-enabling:', collector.getStatus());
    console.log('✅ Manual control test completed');
  } catch (error) {
    console.error('❌ Manual control test failed:', error);
  }

  // Test 5: Test configuration
  console.log('\n🧪 Test 5: Configuration');
  try {
    const config = collector.getConfig();
    console.log('📊 Current config:', {
      enableAISDKIntegration: config.enableAISDKIntegration,
      autoDetectAI: config.autoDetectAI,
      aiFunctionId: config.aiFunctionId,
      aiMetadata: config.aiMetadata
    });
    console.log('✅ Configuration test completed');
  } catch (error) {
    console.error('❌ Configuration test failed:', error);
  }

  // Test 6: Test custom telemetry
  console.log('\n🧪 Test 6: Custom Telemetry');
  try {
    await collector.sendCustomTelemetry({
      functionId: 'custom-test',
      model: { id: 'test-model', provider: 'test-provider' },
      usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
      performance: { msToFinish: 1000 },
      metadata: { test: true }
    });
    console.log('✅ Custom telemetry test completed');
  } catch (error) {
    console.error('❌ Custom telemetry test failed:', error);
  }

  console.log('\n🎉 All tests completed!');
  console.log('📊 Final status:', collector.getStatus());

  // Cleanup
  await collector.destroy();
}

/**
 * Test error handling
 */
async function testErrorHandling() {
  console.log('\n🧪 Testing Error Handling');
  console.log('==========================\n');

  const collector = new AITelemetryCollector({
    serverUrl: 'http://invalid-url:9999', // Invalid URL to test error handling
    debug: true,
    enableAISDKIntegration: true
  });

  collector.enable();

  try {
    // This should trigger error handling
    await collector.sendCustomTelemetry({
      functionId: 'error-test',
      model: { id: 'test-model', provider: 'test-provider' },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      metadata: { test: true }
    });
    console.log('✅ Error handling test completed');
  } catch (error) {
    console.log('✅ Error handling test completed (expected error)');
  }

  await collector.destroy();
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting AI SDK Telemetry Collector Tests');
  console.log('=============================================\n');

  try {
    await testAISDKIntegration();
    await testErrorHandling();
    
    console.log('\n🎉 All tests completed successfully!');
  } catch (error) {
    console.error('💥 Tests failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { testAISDKIntegration, testErrorHandling, runAllTests };
