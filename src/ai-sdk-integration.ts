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
 * Interface for telemetry context used during AI operations
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
  // Content capture fields (optional, controlled by config)
  messages?: any[];
  userPrompt?: string;
  systemPrompt?: string;
  responseContent?: string;
}

/**
 * AI SDK Integration class that automatically hooks into AI SDK operations
 * and collects telemetry data without manual intervention.
 */
export class AISDKIntegration {
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
   * Enable automatic AI SDK integration
   */
  enable(): void {
    if (this.isEnabled) {
      this.log('AI SDK integration is already enabled');
      return;
    }
    
    this.isEnabled = true;
    this.instrumentAI();
    this.log('AI SDK integration enabled');
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

      this.log('Successfully instrumented AI SDK functions');
    } catch (error) {
      // Fallback to ESM dynamic import without blocking enable()
      // Note: This is fire-and-forget to keep API synchronous
      import('ai')
        .then((mod: any) => {
          this.aiModule = mod;
          if (mod?.streamText) {
            this.originalStreamText = mod.streamText;
            mod.streamText = this.wrapStreamText(mod.streamText);
          }
          if (mod?.generateText) {
            this.originalGenerateText = mod.generateText;
            mod.generateText = this.wrapGenerateText(mod.generateText);
          }
          if (mod?.streamObject) {
            this.originalStreamObject = mod.streamObject;
            mod.streamObject = this.wrapStreamObject(mod.streamObject);
          }
          this.log('Successfully instrumented AI SDK functions (via dynamic import)');
        })
        .catch((err) => {
          this.log(`Could not instrument AI SDK: ${(err as Error).message}`);
        });
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
      
      const { userPrompt, systemPrompt } = this.extractPrompts(options.messages || []);

      // Create telemetry context
      const telemetryContext: TelemetryContext = {
        requestId,
        sessionId,
        functionId: options.experimental_telemetry?.functionId || 'streamText',
        startTime,
        model: this.extractModelInfo(options.model),
        settings: this.extractSettings(options),
        metadata: options.experimental_telemetry?.metadata || {},
        messages: options.messages,
        userPrompt,
        systemPrompt
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
      
      const { userPrompt, systemPrompt } = this.extractPrompts(options.messages || []);

      const telemetryContext: TelemetryContext = {
        requestId,
        sessionId,
        functionId: options.experimental_telemetry?.functionId || 'generateText',
        startTime,
        model: this.extractModelInfo(options.model),
        settings: this.extractSettings(options),
        metadata: options.experimental_telemetry?.metadata || {},
        messages: options.messages,
        userPrompt,
        systemPrompt
      };

      try {
        const result = await originalGenerateText(options);
        // Capture response content for non-streaming if enabled
        if (this.collector.getConfig().captureResponses !== false) {
          telemetryContext.responseContent = this.truncateAndMaybeRedact(String(result?.text ?? ''));
        }

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
      
      const { userPrompt, systemPrompt } = this.extractPrompts(options.messages || []);

      const telemetryContext: TelemetryContext = {
        requestId,
        sessionId,
        functionId: options.experimental_telemetry?.functionId || 'streamObject',
        startTime,
        model: this.extractModelInfo(options.model),
        settings: this.extractSettings(options),
        metadata: options.experimental_telemetry?.metadata || {},
        messages: options.messages,
        userPrompt,
        systemPrompt
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
   * Setup telemetry collection for streaming responses
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
                  // Stream finished, record completion
                  if (firstChunkTime) {
                    telemetryContext.firstChunkTime = firstChunkTime;
                    telemetryContext.totalTime = Date.now() - telemetryContext.startTime;
                    telemetryContext.chunkCount = chunkCount;
                  }
                  if (this.collector.getConfig().captureResponses !== false) {
                    telemetryContext.responseContent = this.truncateAndMaybeRedact(responseContent);
                  }
                  controller.close();
                  break;
                }

                if (value && firstChunkTime === null) {
                  firstChunkTime = Date.now();
                }
                chunkCount++;

                // Accumulate response content if capturing is enabled
                if (value && this.collector.getConfig().captureResponses !== false) {
                  try {
                    const chunkText = new TextDecoder().decode(value);
                    responseContent += chunkText;
                  } catch {}
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
   * Record completion telemetry
   */
  private recordCompletion(telemetryContext: TelemetryContext, result: any, responseTime: number): void {
    const capturedMetadata = this.buildCapturedMetadata(telemetryContext, result);

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
      metadata: { ...telemetryContext.metadata, ...capturedMetadata },
      timestamp: new Date().toISOString(),
      spanContext: {
        traceId: telemetryContext.requestId,
        spanId: telemetryContext.sessionId
      }
    };

    this.collector.sendCustomTelemetry(telemetryData);
  }

  /**
   * Record error telemetry
   */
  private recordError(telemetryContext: TelemetryContext, error: Error): void {
    const capturedMetadata = this.buildCapturedMetadata(telemetryContext, undefined);

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
        ...capturedMetadata,
        error: error.message,
        errorType: error.name
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
   * Extract user/system prompt from messages array
   */
  private extractPrompts(messages: any[]): { userPrompt?: string; systemPrompt?: string } {
    try {
      let lastUser: string | undefined;
      let lastSystem: string | undefined;
      for (const msg of messages) {
        if (!msg || !msg.role) continue;
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        if (msg.role === 'user') lastUser = content;
        if (msg.role === 'system') lastSystem = content;
      }
      const cfg = this.collector.getConfig();
      return {
        userPrompt: cfg.capturePrompts === false ? undefined : this.truncateAndMaybeRedact(lastUser ?? ''),
        systemPrompt: cfg.captureSystemPrompt === false ? undefined : this.truncateAndMaybeRedact(lastSystem ?? '')
      };
    } catch {
      return {};
    }
  }

  /**
   * Build captured metadata block based on config flags
   */
  private buildCapturedMetadata(telemetryContext: TelemetryContext, result?: any): Record<string, any> {
    const cfg = this.collector.getConfig();
    const metadata: Record<string, any> = {};

    const prompt = telemetryContext.userPrompt;
    const sys = telemetryContext.systemPrompt;
    const resp = telemetryContext.responseContent ?? (result?.text ? String(result.text) : undefined);

    if (cfg.capturePrompts !== false && prompt) {
      metadata.prompt = prompt;
      metadata.promptLength = prompt.length;
      metadata.hasUserPrompt = true;
    }

    if (cfg.captureSystemPrompt !== false && sys) {
      metadata.systemPrompt = sys;
      metadata.systemPromptLength = sys.length;
      metadata.hasSystemPrompt = true;
    }

    if (cfg.captureResponses !== false && resp) {
      const safeResp = this.truncateAndMaybeRedact(resp);
      metadata.response = safeResp;
      metadata.responseLength = safeResp.length;
      metadata.hasResponse = true;
    }

    if (telemetryContext.messages) {
      metadata.messageCount = telemetryContext.messages.length;
    }

    return metadata;
  }

  /**
   * Truncate to maxContentLength and optionally redact sensitive data
   */
  private truncateAndMaybeRedact(text: string): string {
    if (!text) return text;
    const { maxContentLength = 10000, redactSensitiveData = false } = this.collector.getConfig();
    let out = text.length > maxContentLength ? text.slice(0, maxContentLength) : text;
    if (redactSensitiveData) {
      // Basic redactions: email, tokens, numbers that look like credit cards
      out = out
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
        .replace(/(api_)?key[a-z0-9_-]{10,}/gi, '[redacted-key]')
        .replace(/\b\d{13,16}\b/g, '[redacted-number]');
    }
    return out;
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
      console.log(`[AISDKIntegration] ${message}`);
    }
  }
}
