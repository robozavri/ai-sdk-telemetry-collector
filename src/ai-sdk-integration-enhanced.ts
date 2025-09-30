import { AITelemetryCollector } from './telemetry-collector';
import { AITelemetryData } from './types';

/**
 * Interface for AI SDK function options
 */
interface AISDKOptions {
  model?: any;
  messages?: any[];
  experimental_telemetry?: {
    isEnabled?: boolean;
    functionId?: string;
    metadata?: Record<string, any>;
  };
  maxTokens?: number;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  [key: string]: any;
}

/**
 * Enhanced interface for telemetry context with content capture
 */
interface TelemetryContext {
  requestId: string;
  sessionId: string;
  functionId: string;
  startTime: number;
  model: {
    id: string;
    provider: string;
  };
  settings: {
    maxOutputTokens: number;
    temperature: number;
    topP: number;
    frequencyPenalty: number;
    presencePenalty: number;
  };
  metadata: Record<string, any>;
  firstChunkTime?: number;
  totalTime?: number;
  chunkCount?: number;
  // NEW: Content capture fields
  messages?: any[];
  responseContent?: string;
  systemPrompt?: string;
  userPrompt?: string;
  allPrompts?: string[]; // All user prompts in conversation
}

/**
 * Enhanced AI SDK Integration class that automatically captures prompts and responses
 */
export class AISDKIntegrationEnhanced {
  private collector: AITelemetryCollector;
  private isEnabled: boolean = false;
  private originalStreamText: any;
  private originalGenerateText: any;
  private originalStreamObject: any;
  private aiModule: any = null;

  constructor(collector: AITelemetryCollector) {
    this.collector = collector;
  }

  /**
   * Enable automatic AI SDK integration with content capture
   */
  enable(): void {
    if (this.isEnabled) {
      this.log('AI SDK integration is already enabled');
      return;
    }
    
    this.isEnabled = true;
    this.instrumentAI();
    this.log('AI SDK integration enabled with content capture');
  }

  /**
   * Disable automatic AI SDK integration
   */
  disable(): void {
    if (!this.isEnabled) {
      return;
    }
    
    this.isEnabled = false;
    this.restoreAI();
    this.log('AI SDK integration disabled');
  }

  /**
   * Check if AI SDK integration is enabled
   */
  isIntegrationEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Instrument AI SDK functions by wrapping them with telemetry collection
   */
  private instrumentAI(): void {
    try {
      // Try to import AI SDK functions dynamically
      this.aiModule = require('ai');
      
      if (this.aiModule?.streamText) {
        this.originalStreamText = this.aiModule.streamText;
        this.aiModule.streamText = this.wrapStreamText(this.aiModule.streamText);
      }
      
      if (this.aiModule?.generateText) {
        this.originalGenerateText = this.aiModule.generateText;
        this.aiModule.generateText = this.wrapGenerateText(this.aiModule.generateText);
      }
      
      if (this.aiModule?.streamObject) {
        this.originalStreamObject = this.aiModule.streamObject;
        this.aiModule.streamObject = this.wrapStreamObject(this.aiModule.streamObject);
      }

      this.log('Successfully instrumented AI SDK functions with content capture');
    } catch (error) {
      this.log(`Could not instrument AI SDK: ${(error as Error).message}`);
    }
  }

  /**
   * Restore original AI SDK functions
   */
  private restoreAI(): void {
    try {
      if (this.aiModule) {
        if (this.originalStreamText) {
          this.aiModule.streamText = this.originalStreamText;
        }
        
        if (this.originalGenerateText) {
          this.aiModule.generateText = this.originalGenerateText;
        }
        
        if (this.originalStreamObject) {
          this.aiModule.streamObject = this.originalStreamObject;
        }
      }

      this.log('Restored original AI SDK functions');
    } catch (error) {
      this.log(`Could not restore AI SDK: ${(error as Error).message}`);
    }
  }

  /**
   * Wrap streamText function with telemetry collection
   */
  private wrapStreamText(originalStreamText: any) {
    return async (options: AISDKOptions) => {
      const startTime = Date.now();
      const requestId = this.generateRequestId();
      const sessionId = this.generateSessionId();
      
      // Extract prompts and system messages
      const { userPrompt, systemPrompt, allPrompts } = this.extractPrompts(options.messages || []);
      
      // Create telemetry context with content
      const telemetryContext: TelemetryContext = {
        requestId,
        sessionId,
        functionId: options.experimental_telemetry?.functionId || 'streamText',
        startTime,
        model: this.extractModelInfo(options.model),
        settings: this.extractSettings(options),
        metadata: options.experimental_telemetry?.metadata || {},
        messages: options.messages,
        systemPrompt,
        userPrompt,
        allPrompts
      };

      try {
        // Call original function
        const result = await originalStreamText(options);
        
        // Wrap the result to collect telemetry on finish
        return this.wrapStreamResult(result, telemetryContext);
      } catch (error) {
        // Record error
        this.recordError(telemetryContext, error as Error);
        throw error;
      }
    };
  }

  /**
   * Wrap generateText function with telemetry collection
   */
  private wrapGenerateText(originalGenerateText: any) {
    return async (options: AISDKOptions) => {
      const startTime = Date.now();
      const requestId = this.generateRequestId();
      const sessionId = this.generateSessionId();
      
      // Extract prompts and system messages
      const { userPrompt, systemPrompt, allPrompts } = this.extractPrompts(options.messages || []);
      
      const telemetryContext: TelemetryContext = {
        requestId,
        sessionId,
        functionId: options.experimental_telemetry?.functionId || 'generateText',
        startTime,
        model: this.extractModelInfo(options.model),
        settings: this.extractSettings(options),
        metadata: options.experimental_telemetry?.metadata || {},
        messages: options.messages,
        systemPrompt,
        userPrompt,
        allPrompts
      };

      try {
        const result = await originalGenerateText(options);
        
        // Store response content
        telemetryContext.responseContent = result.text;
        
        // Record completion
        this.recordCompletion(telemetryContext, result, Date.now() - startTime);
        
        return result;
      } catch (error) {
        this.recordError(telemetryContext, error as Error);
        throw error;
      }
    };
  }

  /**
   * Wrap streamObject function with telemetry collection
   */
  private wrapStreamObject(originalStreamObject: any) {
    return async (options: AISDKOptions) => {
      const startTime = Date.now();
      const requestId = this.generateRequestId();
      const sessionId = this.generateSessionId();
      
      // Extract prompts and system messages
      const { userPrompt, systemPrompt, allPrompts } = this.extractPrompts(options.messages || []);
      
      const telemetryContext: TelemetryContext = {
        requestId,
        sessionId,
        functionId: options.experimental_telemetry?.functionId || 'streamObject',
        startTime,
        model: this.extractModelInfo(options.model),
        settings: this.extractSettings(options),
        metadata: options.experimental_telemetry?.metadata || {},
        messages: options.messages,
        systemPrompt,
        userPrompt,
        allPrompts
      };

      try {
        const result = await originalStreamObject(options);
        return this.wrapStreamResult(result, telemetryContext);
      } catch (error) {
        this.recordError(telemetryContext, error as Error);
        throw error;
      }
    };
  }

  /**
   * Extract user prompts, system prompts, and all prompts from messages
   */
  private extractPrompts(messages: any[]): { 
    userPrompt?: string; 
    systemPrompt?: string; 
    allPrompts: string[] 
  } {
    let userPrompt: string | undefined;
    let systemPrompt: string | undefined;
    const allPrompts: string[] = [];

    for (const message of messages) {
      if (message.content) {
        if (message.role === 'user') {
          userPrompt = message.content;
          allPrompts.push(`User: ${message.content}`);
        } else if (message.role === 'system') {
          systemPrompt = message.content;
          allPrompts.push(`System: ${message.content}`);
        } else if (message.role === 'assistant') {
          allPrompts.push(`Assistant: ${message.content}`);
        }
      }
    }

    return { userPrompt, systemPrompt, allPrompts };
  }

  /**
   * Wrap stream result to collect telemetry on finish
   */
  private wrapStreamResult(result: any, telemetryContext: TelemetryContext) {
    // Store original methods
    const originalToDataStreamResponse = result.toDataStreamResponse?.bind(result);
    const originalToUIMessageStreamResponse = result.toUIMessageStreamResponse?.bind(result);
    const originalToTextStreamResponse = result.toTextStreamResponse?.bind(result);

    // Wrap toDataStreamResponse
    if (originalToDataStreamResponse) {
      result.toDataStreamResponse = () => {
        const response = originalToDataStreamResponse();
        this.setupStreamTelemetry(response, telemetryContext);
        return response;
      };
    }

    // Wrap toUIMessageStreamResponse
    if (originalToUIMessageStreamResponse) {
      result.toUIMessageStreamResponse = () => {
        const response = originalToUIMessageStreamResponse();
        this.setupStreamTelemetry(response, telemetryContext);
        return response;
      };
    }

    // Wrap toTextStreamResponse
    if (originalToTextStreamResponse) {
      result.toTextStreamResponse = () => {
        const response = originalToTextStreamResponse();
        this.setupStreamTelemetry(response, telemetryContext);
        return response;
      };
    }

    return result;
  }

  /**
   * Setup telemetry collection for streaming responses with content capture
   */
  private setupStreamTelemetry(response: any, telemetryContext: TelemetryContext): void {
    if (!response || typeof response !== 'object') return;

    // Store telemetry context on the response
    response._telemetryContext = telemetryContext;

    // Wrap the response body if it's a ReadableStream
    if (response.body && response.body instanceof ReadableStream) {
      const originalReader = response.body.getReader();
      let firstChunkTime: number | null = null;
      let chunkCount = 0;
      let responseContent = '';

      const wrappedStream = new ReadableStream({
        start: (controller) => {
          const pump = async () => {
            try {
              while (true) {
                const { done, value } = await originalReader.read();
                
                if (done) {
                  // Stream finished, store response content and record completion
                  telemetryContext.responseContent = responseContent;
                  if (firstChunkTime) {
                    telemetryContext.firstChunkTime = firstChunkTime;
                    telemetryContext.totalTime = Date.now() - telemetryContext.startTime;
                    telemetryContext.chunkCount = chunkCount;
                  }
                  controller.close();
                  break;
                }

                if (value && firstChunkTime === null) {
                  firstChunkTime = Date.now();
                }
                chunkCount++;

                // Collect response content for telemetry
                if (value) {
                  const chunk = new TextDecoder().decode(value);
                  responseContent += chunk;
                }

                controller.enqueue(value);
              }
            } catch (error) {
              controller.error(error);
            }
          };
          pump();
        }
      });

      response.body = wrappedStream;
    }

    // Set up completion handler
    if (response.onFinish) {
      const originalOnFinish = response.onFinish;
      response.onFinish = (result: any) => {
        this.recordCompletion(telemetryContext, result, Date.now() - telemetryContext.startTime);
        if (originalOnFinish) originalOnFinish(result);
      };
    } else {
      response.onFinish = (result: any) => {
        this.recordCompletion(telemetryContext, result, Date.now() - telemetryContext.startTime);
      };
    }
  }

  /**
   * Record completion telemetry with actual prompts and responses
   */
  private recordCompletion(telemetryContext: TelemetryContext, result: any, responseTime: number): void {
    const telemetryData: AITelemetryData = {
      id: telemetryContext.requestId,
      functionId: telemetryContext.functionId,
      model: telemetryContext.model,
      usage: result.usage || {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      },
      performance: {
        msToFirstChunk: telemetryContext.firstChunkTime ? 
          telemetryContext.firstChunkTime - telemetryContext.startTime : 0,
        msToFinish: responseTime,
        avgCompletionTokensPerSecond: result.usage?.completionTokens ? 
          (result.usage.completionTokens / (responseTime / 1000)) : 0,
        chunkCount: telemetryContext.chunkCount || 0
      },
      tools: [], // Will be populated by span processor if available
      settings: telemetryContext.settings,
      metadata: {
        ...telemetryContext.metadata,
        // ACTUAL CONTENT CAPTURE:
        prompt: telemetryContext.userPrompt,
        response: telemetryContext.responseContent,
        systemPrompt: telemetryContext.systemPrompt,
        allPrompts: telemetryContext.allPrompts,
        
        // Content lengths
        promptLength: telemetryContext.userPrompt?.length || 0,
        responseLength: telemetryContext.responseContent?.length || 0,
        systemPromptLength: telemetryContext.systemPrompt?.length || 0,
        totalPromptsLength: telemetryContext.allPrompts.join(' ').length,
        
        // Additional context
        messageCount: telemetryContext.messages?.length || 0,
        hasSystemPrompt: !!telemetryContext.systemPrompt,
        hasUserPrompt: !!telemetryContext.userPrompt,
        hasResponse: !!telemetryContext.responseContent,
        
        // Conversation context
        conversationLength: telemetryContext.allPrompts.length,
        isMultiTurn: telemetryContext.allPrompts.length > 2
      },
      timestamp: new Date().toISOString(),
      spanContext: {
        traceId: telemetryContext.requestId,
        spanId: telemetryContext.sessionId
      }
    };

    this.collector.sendCustomTelemetry(telemetryData);
  }

  /**
   * Record error telemetry with prompts
   */
  private recordError(telemetryContext: TelemetryContext, error: Error): void {
    const telemetryData: AITelemetryData = {
      id: telemetryContext.requestId,
      functionId: telemetryContext.functionId,
      model: telemetryContext.model,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      performance: {
        msToFirstChunk: 0,
        msToFinish: Date.now() - telemetryContext.startTime,
        avgCompletionTokensPerSecond: 0,
        chunkCount: 0
      },
      tools: [],
      settings: telemetryContext.settings,
      metadata: {
        ...telemetryContext.metadata,
        // Include prompts even in error cases
        prompt: telemetryContext.userPrompt,
        systemPrompt: telemetryContext.systemPrompt,
        allPrompts: telemetryContext.allPrompts,
        
        // Content lengths
        promptLength: telemetryContext.userPrompt?.length || 0,
        systemPromptLength: telemetryContext.systemPrompt?.length || 0,
        totalPromptsLength: telemetryContext.allPrompts.join(' ').length,
        
        // Error information
        error: error.message,
        errorType: error.name,
        hasSystemPrompt: !!telemetryContext.systemPrompt,
        hasUserPrompt: !!telemetryContext.userPrompt,
        conversationLength: telemetryContext.allPrompts.length
      },
      timestamp: new Date().toISOString(),
      spanContext: {
        traceId: telemetryContext.requestId,
        spanId: telemetryContext.sessionId
      }
    };

    this.collector.sendCustomTelemetry(telemetryData);
  }

  /**
   * Extract model information from AI SDK options
   */
  private extractModelInfo(model: any): { id: string; provider: string } {
    if (!model) return { id: 'unknown', provider: 'unknown' };
    
    // Handle different model formats
    if (typeof model === 'string') {
      return { id: model, provider: 'unknown' };
    }
    
    if (model.modelId) {
      return { id: model.modelId, provider: model.provider || 'unknown' };
    }
    
    if (model.id) {
      return { id: model.id, provider: model.provider || 'unknown' };
    }
    
    return { id: 'unknown', provider: 'unknown' };
  }

  /**
   * Extract settings from AI SDK options
   */
  private extractSettings(options: AISDKOptions): {
    maxOutputTokens: number;
    temperature: number;
    topP: number;
    frequencyPenalty: number;
    presencePenalty: number;
  } {
    return {
      maxOutputTokens: options.maxTokens || options.maxOutputTokens || 1000,
      temperature: options.temperature || 0.7,
      topP: options.topP || 1,
      frequencyPenalty: options.frequencyPenalty || 0,
      presencePenalty: options.presencePenalty || 0
    };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log debug messages
   */
  private log(message: string): void {
    if (this.collector.getConfig().debug) {
      console.log(`[AISDKIntegrationEnhanced] ${message}`);
    }
  }
}
