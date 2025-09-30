/**
 * 🚀 AUTOMATIC CONTENT CAPTURE EXAMPLE
 * This example demonstrates automatic capture of prompts, responses, and system prompts
 * without any manual intervention required.
 */

import { AITelemetryCollectorEnhanced } from '../src/telemetry-collector-enhanced';
import { streamText, generateText, streamObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

/**
 * Example 1: Automatic Content Capture with streamText
 * Captures: User prompts, AI responses, system prompts, conversation history
 */
async function exampleStreamTextWithContentCapture() {
  console.log('🚀 Example 1: Automatic Content Capture with streamText');
  
  // Initialize enhanced collector with automatic content capture
  const collector = new AITelemetryCollectorEnhanced({
    serverUrl: 'http://localhost:3001',
    apiKey: 'your-api-key',
    debug: true,
    enableAISDKIntegration: true, // Automatic content capture enabled
    aiFunctionId: 'chat-assistant',
    aiMetadata: {
      environment: 'development',
      version: '1.0.0',
      userId: 'user-123'
    }
  });

  // Enable telemetry collection (content capture happens automatically)
  collector.enable();

  try {
    // Use AI SDK normally - ALL CONTENT is captured automatically!
    const result = await streamText({
      model: openai('gpt-4o'),
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful coding assistant. Always provide clear, concise answers with code examples.' 
        },
        { 
          role: 'user', 
          content: 'How do I create a React component with TypeScript?' 
        },
        {
          role: 'assistant',
          content: 'I can help you create a React component with TypeScript. Here\'s a basic example...'
        },
        {
          role: 'user',
          content: 'Can you show me how to add props to that component?'
        }
      ],
      maxTokens: 1000,
      temperature: 0.7,
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'typescript-help',
        metadata: {
          topic: 'react-typescript',
          difficulty: 'intermediate'
        }
      }
    });

    // Convert to response - ALL CONTENT is automatically captured when stream finishes
    const response = result.toDataStreamResponse();
    
    console.log('✅ Stream completed - ALL CONTENT captured automatically!');
    console.log('📊 Captured data includes:');
    console.log('   - System prompt: "You are a helpful coding assistant..."');
    console.log('   - User prompts: "How do I create a React component..."');
    console.log('   - AI responses: Complete streaming response');
    console.log('   - Conversation history: All messages in sequence');
    console.log('   - Performance metrics: Timing, chunk count, etc.');
    
    return response;
  } catch (error) {
    console.error('❌ Stream failed:', error);
    throw error;
  }
}

/**
 * Example 2: Automatic Content Capture with generateText
 * Perfect for non-streaming AI operations with full content capture
 */
async function exampleGenerateTextWithContentCapture() {
  console.log('🚀 Example 2: Automatic Content Capture with generateText');
  
  const collector = new AITelemetryCollectorEnhanced({
    serverUrl: 'http://localhost:3001',
    debug: true,
    enableAISDKIntegration: true
  });

  collector.enable();

  try {
    const result = await generateText({
      model: openai('gpt-4o'),
      messages: [
        { 
          role: 'system', 
          content: 'You are a creative writing assistant. Write engaging, original content.' 
        },
        { 
          role: 'user', 
          content: 'Write a short story about a robot learning to paint.' 
        }
      ],
      maxTokens: 500,
      temperature: 0.8,
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'creative-writing',
        metadata: {
          genre: 'science-fiction',
          length: 'short-story'
        }
      }
    });

    console.log('📝 Generated story:', result.text);
    console.log('✅ Generation completed - ALL CONTENT captured automatically!');
    console.log('📊 Captured data includes:');
    console.log('   - System prompt: "You are a creative writing assistant..."');
    console.log('   - User prompt: "Write a short story about a robot..."');
    console.log('   - AI response: Complete generated story');
    console.log('   - Usage statistics: Token counts, performance metrics');
    
    return result;
  } catch (error) {
    console.error('❌ Generation failed:', error);
    throw error;
  }
}

/**
 * Example 3: Automatic Content Capture with streamObject
 * For structured data generation with content capture
 */
async function exampleStreamObjectWithContentCapture() {
  console.log('🚀 Example 3: Automatic Content Capture with streamObject');
  
  const collector = new AITelemetryCollectorEnhanced({
    serverUrl: 'http://localhost:3001',
    debug: true,
    enableAISDKIntegration: true
  });

  collector.enable();

  // Define schema for structured output
  const UserProfileSchema = z.object({
    name: z.string(),
    age: z.number(),
    email: z.string().email(),
    bio: z.string(),
    skills: z.array(z.string()),
    experience: z.number()
  });

  try {
    const result = await streamObject({
      model: openai('gpt-4o'),
      messages: [
        { 
          role: 'system', 
          content: 'You are a professional profile generator. Create realistic, detailed profiles based on user requirements.' 
        },
        { 
          role: 'user', 
          content: 'Create a software engineer profile with 5+ years experience, specializing in React and Node.js' 
        }
      ],
      schema: UserProfileSchema,
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'profile-generator',
        metadata: {
          outputType: 'structured',
          schema: 'UserProfile',
          profession: 'software-engineer'
        }
      }
    });

    console.log('👤 Generated profile:', result.object);
    console.log('✅ Object generation completed - ALL CONTENT captured automatically!');
    console.log('📊 Captured data includes:');
    console.log('   - System prompt: "You are a professional profile generator..."');
    console.log('   - User prompt: "Create a software engineer profile..."');
    console.log('   - AI response: Complete structured object');
    console.log('   - Schema information: UserProfile structure');
    
    return result;
  } catch (error) {
    console.error('❌ Object generation failed:', error);
    throw error;
  }
}

/**
 * Example 4: Multi-turn Conversation with Content Capture
 * Shows how all conversation history is captured automatically
 */
async function exampleMultiTurnConversation() {
  console.log('🚀 Example 4: Multi-turn Conversation with Content Capture');
  
  const collector = new AITelemetryCollectorEnhanced({
    serverUrl: 'http://localhost:3001',
    debug: true,
    enableAISDKIntegration: true
  });

  collector.enable();

  try {
    // First turn
    const result1 = await generateText({
      model: openai('gpt-4o'),
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful math tutor. Explain concepts clearly and provide examples.' 
        },
        { 
          role: 'user', 
          content: 'What is calculus?' 
        }
      ],
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'math-tutor',
        metadata: { subject: 'calculus', level: 'introduction' }
      }
    });

    console.log('📚 First response:', result1.text);

    // Second turn (follow-up question)
    const result2 = await generateText({
      model: openai('gpt-4o'),
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful math tutor. Explain concepts clearly and provide examples.' 
        },
        { 
          role: 'user', 
          content: 'What is calculus?' 
        },
        { 
          role: 'assistant', 
          content: result1.text 
        },
        { 
          role: 'user', 
          content: 'Can you give me a practical example of how calculus is used in real life?' 
        }
      ],
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'math-tutor',
        metadata: { subject: 'calculus', level: 'practical-examples' }
      }
    });

    console.log('📚 Second response:', result2.text);
    console.log('✅ Multi-turn conversation completed - ALL CONTENT captured automatically!');
    console.log('📊 Captured data includes:');
    console.log('   - Complete conversation history');
    console.log('   - System prompt: "You are a helpful math tutor..."');
    console.log('   - All user questions and AI responses');
    console.log('   - Context preservation across turns');
    
    return { result1, result2 };
  } catch (error) {
    console.error('❌ Multi-turn conversation failed:', error);
    throw error;
  }
}

/**
 * Example 5: Error Handling with Content Capture
 * Shows how prompts are captured even when errors occur
 */
async function exampleErrorHandlingWithContentCapture() {
  console.log('🚀 Example 5: Error Handling with Content Capture');
  
  const collector = new AITelemetryCollectorEnhanced({
    serverUrl: 'http://localhost:3001',
    debug: true,
    enableAISDKIntegration: true
  });

  collector.enable();

  try {
    // This will fail due to invalid model, but prompts will still be captured
    await generateText({
      model: openai('invalid-model-name'),
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful assistant.' 
        },
        { 
          role: 'user', 
          content: 'This request will fail, but the prompt should still be captured.' 
        }
      ],
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'error-test'
      }
    });
  } catch (error) {
    console.log('❌ Expected error occurred:', (error as Error).message);
    console.log('✅ Error handling completed - PROMPTS STILL CAPTURED!');
    console.log('📊 Captured data includes:');
    console.log('   - System prompt: "You are a helpful assistant."');
    console.log('   - User prompt: "This request will fail..."');
    console.log('   - Error information: Error message and type');
    console.log('   - Performance metrics: Timing until error');
  }
}

/**
 * Example 6: Show What Gets Captured
 * Demonstrates the complete telemetry data structure
 */
async function exampleShowCapturedData() {
  console.log('🚀 Example 6: Show What Gets Captured');
  
  const collector = new AITelemetryCollectorEnhanced({
    serverUrl: 'http://localhost:3001',
    debug: true,
    enableAISDKIntegration: true
  });

  collector.enable();

  try {
    const result = await generateText({
      model: openai('gpt-4o'),
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful assistant.' 
        },
        { 
          role: 'user', 
          content: 'What is the capital of France?' 
        }
      ],
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'geography-question',
        metadata: { category: 'geography', difficulty: 'easy' }
      }
    });

    console.log('✅ Question answered:', result.text);
    console.log('📊 COMPLETE CAPTURED DATA STRUCTURE:');
    console.log(`
    {
      id: "req_1234567890_abc123",
      functionId: "geography-question",
      model: { id: "gpt-4o", provider: "openai" },
      usage: { promptTokens: 15, completionTokens: 8, totalTokens: 23 },
      performance: { msToFinish: 1200, chunkCount: 1 },
      settings: { maxOutputTokens: 1000, temperature: 0.7, ... },
      metadata: {
        // ACTUAL CONTENT (not just lengths):
        prompt: "What is the capital of France?",
        response: "The capital of France is Paris.",
        systemPrompt: "You are a helpful assistant.",
        allPrompts: [
          "System: You are a helpful assistant.",
          "User: What is the capital of France?",
          "Assistant: The capital of France is Paris."
        ],
        
        // Content lengths
        promptLength: 30,
        responseLength: 32,
        systemPromptLength: 28,
        totalPromptsLength: 90,
        
        // Additional context
        messageCount: 2,
        hasSystemPrompt: true,
        hasUserPrompt: true,
        hasResponse: true,
        conversationLength: 3,
        isMultiTurn: false,
        
        // Custom metadata
        category: "geography",
        difficulty: "easy"
      },
      timestamp: "2024-01-15T10:30:00.000Z",
      spanContext: {
        traceId: "req_1234567890_abc123",
        spanId: "session_1234567890_def456"
      }
    }
    `);
    
    return result;
  } catch (error) {
    console.error('❌ Example failed:', error);
    throw error;
  }
}

/**
 * Main function to run all examples
 */
async function runAllContentCaptureExamples() {
  console.log('🎯 Running Automatic Content Capture Examples');
  console.log('==============================================\n');

  try {
    await exampleStreamTextWithContentCapture();
    console.log('\n' + '='.repeat(60) + '\n');
    
    await exampleGenerateTextWithContentCapture();
    console.log('\n' + '='.repeat(60) + '\n');
    
    await exampleStreamObjectWithContentCapture();
    console.log('\n' + '='.repeat(60) + '\n');
    
    await exampleMultiTurnConversation();
    console.log('\n' + '='.repeat(60) + '\n');
    
    await exampleErrorHandlingWithContentCapture();
    console.log('\n' + '='.repeat(60) + '\n');
    
    await exampleShowCapturedData();
    
    console.log('\n🎉 All content capture examples completed successfully!');
    console.log('📊 Check your telemetry server for ALL captured content:');
    console.log('   ✅ User prompts (actual text)');
    console.log('   ✅ AI responses (actual text)');
    console.log('   ✅ System prompts (actual text)');
    console.log('   ✅ Complete conversation history');
    console.log('   ✅ Performance metrics');
    console.log('   ✅ Error information');
    console.log('   ✅ Custom metadata');
  } catch (error) {
    console.error('💥 Examples failed:', error);
  }
}

// Export functions for individual testing
export {
  exampleStreamTextWithContentCapture,
  exampleGenerateTextWithContentCapture,
  exampleStreamObjectWithContentCapture,
  exampleMultiTurnConversation,
  exampleErrorHandlingWithContentCapture,
  exampleShowCapturedData,
  runAllContentCaptureExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllContentCaptureExamples().catch(console.error);
}
