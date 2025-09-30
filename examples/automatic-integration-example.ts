/**
 * Example demonstrating automatic AI SDK integration
 * This example shows how the telemetry collector automatically hooks into AI SDK operations
 * without requiring manual telemetry calls.
 */

import { AITelemetryCollector } from '../src/telemetry-collector';
import { streamText, generateText, streamObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

/**
 * Example 1: Automatic Integration with streamText
 * No manual telemetry calls required - everything is automatic!
 */
async function exampleStreamText() {
  console.log('🚀 Example 1: Automatic streamText Integration');
  
  // Initialize collector with automatic AI SDK integration enabled
  const collector = new AITelemetryCollector({
    serverUrl: 'http://localhost:3001',
    apiKey: 'your-api-key',
    debug: true,
    enableAISDKIntegration: true, // This is the default
    aiFunctionId: 'chat-assistant', // Default function ID
    aiMetadata: {
      environment: 'development',
      version: '1.0.0',
      userId: 'user-123'
    }
  });

  // Enable telemetry collection (AI SDK integration happens automatically)
  collector.enable();

  try {
    // Use AI SDK normally - telemetry is collected automatically
    const result = await streamText({
      model: openai('gpt-4o'),
      messages: [
        { role: 'user', content: 'Hello! Can you help me understand TypeScript?' }
      ],
      maxTokens: 1000,
      temperature: 0.7,
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'typescript-help', // Override default function ID
        metadata: {
          topic: 'typescript',
          difficulty: 'beginner'
        }
      }
    });

    // Convert to response - telemetry will be collected when stream finishes
    const response = result.toDataStreamResponse();
    
    console.log('✅ Stream completed - telemetry collected automatically');
    console.log('📊 Check your telemetry server for received data');
    
    return response;
  } catch (error) {
    console.error('❌ Stream failed:', error);
    throw error;
  }
}

/**
 * Example 2: Automatic Integration with generateText
 * Perfect for non-streaming AI operations
 */
async function exampleGenerateText() {
  console.log('🚀 Example 2: Automatic generateText Integration');
  
  const collector = new AITelemetryCollector({
    serverUrl: 'http://localhost:3001',
    debug: true,
    enableAISDKIntegration: true
  });

  collector.enable();

  try {
    const result = await generateText({
      model: openai('gpt-4o'),
      messages: [
        { role: 'user', content: 'Write a short poem about coding' }
      ],
      maxTokens: 200,
      temperature: 0.8,
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'poem-generator',
        metadata: {
          style: 'poetry',
          length: 'short'
        }
      }
    });

    console.log('📝 Generated text:', result.text);
    console.log('✅ Generation completed - telemetry collected automatically');
    
    return result;
  } catch (error) {
    console.error('❌ Generation failed:', error);
    throw error;
  }
}

/**
 * Example 3: Automatic Integration with streamObject
 * For structured data generation
 */
async function exampleStreamObject() {
  console.log('🚀 Example 3: Automatic streamObject Integration');
  
  const collector = new AITelemetryCollector({
    serverUrl: 'http://localhost:3001',
    debug: true,
    enableAISDKIntegration: true
  });

  collector.enable();

  // Define schema for structured output
  const UserSchema = z.object({
    name: z.string(),
    age: z.number(),
    email: z.string().email(),
    interests: z.array(z.string())
  });

  try {
    const result = await streamObject({
      model: openai('gpt-4o'),
      messages: [
        { role: 'user', content: 'Create a user profile for a software developer' }
      ],
      schema: UserSchema,
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'user-profile-generator',
        metadata: {
          outputType: 'structured',
          schema: 'UserProfile'
        }
      }
    });

    console.log('👤 Generated user profile:', result.object);
    console.log('✅ Object generation completed - telemetry collected automatically');
    
    return result;
  } catch (error) {
    console.error('❌ Object generation failed:', error);
    throw error;
  }
}

/**
 * Example 4: Manual Control of AI SDK Integration
 * Shows how to enable/disable integration at runtime
 */
async function exampleManualControl() {
  console.log('🚀 Example 4: Manual Control of AI SDK Integration');
  
  const collector = new AITelemetryCollector({
    serverUrl: 'http://localhost:3001',
    debug: true,
    enableAISDKIntegration: false // Start with integration disabled
  });

  collector.enable();

  // Check initial status
  let status = collector.getStatus();
  console.log('📊 Initial status:', status);

  // Disable AI SDK integration
  collector.disableAISDKIntegration();
  status = collector.getStatus();
  console.log('📊 After disabling AI SDK integration:', status);

  // Enable AI SDK integration
  collector.enableAISDKIntegration();
  status = collector.getStatus();
  console.log('📊 After enabling AI SDK integration:', status);

  // Now AI SDK calls will be automatically instrumented
  try {
    const result = await generateText({
      model: openai('gpt-4o'),
      messages: [
        { role: 'user', content: 'Say hello!' }
      ],
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'hello-generator'
      }
    });

    console.log('👋 Generated:', result.text);
    console.log('✅ Manual control example completed');
  } catch (error) {
    console.error('❌ Manual control example failed:', error);
  }
}

/**
 * Example 5: Error Handling
 * Shows how errors are automatically captured in telemetry
 */
async function exampleErrorHandling() {
  console.log('🚀 Example 5: Error Handling');
  
  const collector = new AITelemetryCollector({
    serverUrl: 'http://localhost:3001',
    debug: true,
    enableAISDKIntegration: true
  });

  collector.enable();

  try {
    // This will fail due to invalid model
    await generateText({
      model: openai('invalid-model-name'),
      messages: [
        { role: 'user', content: 'This should fail' }
      ],
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'error-test'
      }
    });
  } catch (error) {
    console.log('❌ Expected error occurred:', (error as Error).message);
    console.log('📊 Error telemetry was automatically collected');
  }
}

/**
 * Example 6: Custom Configuration
 * Shows advanced configuration options
 */
async function exampleCustomConfiguration() {
  console.log('🚀 Example 6: Custom Configuration');
  
  const collector = new AITelemetryCollector({
    serverUrl: 'http://localhost:3001',
    apiKey: 'your-api-key',
    debug: true,
    batchSize: 5,
    batchTimeout: 2000,
    enableAISDKIntegration: true,
    autoDetectAI: true,
    aiFunctionId: 'custom-function',
    aiMetadata: {
      environment: 'production',
      version: '2.0.0',
      region: 'us-east-1'
    },
    headers: {
      'X-Custom-Header': 'custom-value'
    },
    retry: {
      maxAttempts: 5,
      delayMs: 2000
    }
  });

  collector.enable();

  try {
    const result = await generateText({
      model: openai('gpt-4o'),
      messages: [
        { role: 'user', content: 'Test custom configuration' }
      ],
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'config-test',
        metadata: {
          testType: 'configuration'
        }
      }
    });

    console.log('✅ Custom configuration test completed');
    console.log('📊 Check telemetry server for custom metadata');
  } catch (error) {
    console.error('❌ Custom configuration test failed:', error);
  }
}

/**
 * Main function to run all examples
 */
async function runAllExamples() {
  console.log('🎯 Running AI SDK Telemetry Collector Examples');
  console.log('===============================================\n');

  try {
    await exampleStreamText();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await exampleGenerateText();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await exampleStreamObject();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await exampleManualControl();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await exampleErrorHandling();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await exampleCustomConfiguration();
    
    console.log('\n🎉 All examples completed successfully!');
    console.log('📊 Check your telemetry server for all collected data');
  } catch (error) {
    console.error('💥 Examples failed:', error);
  }
}

// Export functions for individual testing
export {
  exampleStreamText,
  exampleGenerateText,
  exampleStreamObject,
  exampleManualControl,
  exampleErrorHandling,
  exampleCustomConfiguration,
  runAllExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}
