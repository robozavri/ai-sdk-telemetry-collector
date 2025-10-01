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
 * Enhanced with Edge Runtime support and multiple fallback strategies.
 */
export class AISDKIntegration {
  private collector: AITelemetryCollector;
  private isEnabled: boolean = false;
  private originalStreamText: any;
  private originalGenerateText: any;
  private originalStreamObject: any;
  private aiModule: any = null;
  private instrumentationValidated: boolean = false;

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
   * Wrap an AI SDK function to automatically capture telemetry.
   * This is the core wrapper method that makes automatic instrumentation work.
   * It detects the function type and applies the appropriate wrapper.
   * 
   * @param aiFunction - The AI SDK function to wrap
   * @returns Wrapped function that captures telemetry automatically
   */
  wrapAIFunction<T extends Function>(aiFunction: T): T {
    // Try to detect the function type by its name or characteristics
    const funcName = aiFunction.name || '';
    
    // Detect function type and apply appropriate wrapper
    if (funcName.includes('streamText') || this.isStreamTextFunction(aiFunction)) {
      return this.wrapStreamText(aiFunction as any) as unknown as T;
    } else if (funcName.includes('generateText') || this.isGenerateTextFunction(aiFunction)) {
      return this.wrapGenerateText(aiFunction as any) as unknown as T;
    } else if (funcName.includes('streamObject') || this.isStreamObjectFunction(aiFunction)) {
      return this.wrapStreamObject(aiFunction as any) as unknown as T;
    } else {
      // Generic wrapper - try to handle it as streamText by default
      this.log(`Wrapping unknown AI function: ${funcName}, using generic wrapper`);
      return this.wrapGenericAIFunction(aiFunction as any) as unknown as T;
    }
  }

  /**
   * Check if function is streamText-like
   */
  private isStreamTextFunction(func: any): boolean {
    // This is a heuristic - in practice, we rely on the user passing the right function
    return typeof func === 'function';
  }

  /**
   * Check if function is generateText-like
   */
  private isGenerateTextFunction(func: any): boolean {
    return typeof func === 'function';
  }

  /**
   * Check if function is streamObject-like
   */
  private isStreamObjectFunction(func: any): boolean {
    return typeof func === 'function';
  }

  /**
   * Generic wrapper for AI functions when type cannot be determined
   */
  private wrapGenericAIFunction(originalFunc: any) {
    return async (options: AISDKOptions) => {
      const startTime = Date.now();
      const requestId = this.generateRequestId();
      const sessionId = this.generateSessionId();
      
      const { userPrompt, systemPrompt } = this.extractPrompts(options.messages || []);

      const telemetryContext: TelemetryContext = {
        requestId,
        sessionId,
        functionId: options.experimental_telemetry?.functionId || 'ai-function',
        startTime,
        model: this.extractModelInfo(options.model),
        settings: this.extractSettings(options),
        metadata: options.experimental_telemetry?.metadata || {},
        messages: options.messages,
        userPrompt,
        systemPrompt
      };

      try {
        const result = await originalFunc(options);
        
        // Try to wrap the result if it looks like a stream result
        if (result && typeof result === 'object' && (result.toDataStreamResponse || result.toTextStreamResponse)) {
          return this.wrapStreamResult(result, telemetryContext);
        }
        
        // Otherwise treat it as non-streaming
        if (this.collector.getConfig().captureResponses !== false) {
          telemetryContext.responseContent = this.truncateAndMaybeRedact(String(result?.text ?? ''));
        }
        this.recordCompletion(telemetryContext, result, Date.now() - startTime);
        
        return result;
      } catch (error) {
        this.recordError(telemetryContext, error as Error);
        throw error;
      }
    };
  }

  /**
   * Detect if running in Edge Runtime environment
   */
  private isEdgeRuntime(): boolean {
    return typeof (globalThis as any).EdgeRuntime !== 'undefined' || 
           (typeof process !== 'undefined' && 
            process.env.NEXT_RUNTIME === 'edge');
  }

  /**
   * Instrument AI SDK functions by wrapping them with telemetry collection
   */
  private instrumentAI(): void {
    this.log('Starting AI SDK instrumentation...');
    
    if (this.isEdgeRuntime()) {
      this.log('Detected Edge runtime, using alternative instrumentation');
      return this.instrumentAIForEdgeRuntime();
    }
    
    // Try to intercept the 'ai' module from Node's cache
    if (this.instrumentFromCache()) {
      return;
    }
    
    // If not in cache, try to load it
    try {
      this.aiModule = require('ai');
      this.log('Successfully loaded AI module via require()');
      this.instrumentModule(this.aiModule);
    } catch (error) {
      this.log(`require() failed, trying dynamic import: ${(error as Error).message}`);
      this.tryDynamicImport();
    }
  }

  /**
   * Attempt to instrument AI SDK from Node's module cache
   * This works if the user has already imported the AI SDK
   */
  private instrumentFromCache(): boolean {
    try {
      // Check if 'ai' module is already in Node's require cache
      const aiModulePath = require.resolve('ai');
      const cachedModule = require.cache[aiModulePath];
      
      if (cachedModule && cachedModule.exports) {
        this.log('Found AI module in require cache, instrumenting...');
        this.aiModule = cachedModule.exports;
        this.instrumentModule(this.aiModule);
        return true;
      }
    } catch (error) {
      this.log(`Could not access require cache: ${(error as Error).message}`);
    }
    return false;
  }

  /**
   * Alternative instrumentation strategy for Edge Runtime
   */
  private instrumentAIForEdgeRuntime(): void {
    this.log('Using Edge runtime instrumentation strategy');
    
    const config = this.collector.getConfig();
    const strategy = config.edgeRuntimeStrategy || 'auto';
    const instrumentation = config.edgeRuntimeInstrumentation || {};
    
    // Strategy 1: Use global function patching
    if (strategy === 'global' || strategy === 'auto') {
      if (instrumentation.useGlobalPatching !== false) {
        this.instrumentGlobalFunctions();
      }
    }
    
    // Strategy 2: Use module-level instrumentation
    if (strategy === 'proxy' || strategy === 'auto') {
      if (instrumentation.useProxyWrapping !== false) {
        this.instrumentGlobalAIFunctions();
      }
    }
    
    // Strategy 3: Use call site instrumentation
    if (strategy === 'callsite' || strategy === 'auto') {
      if (instrumentation.useCallSiteInstrumentation !== false) {
        this.setupCallSiteInstrumentation();
      }
    }
    
    // Validate instrumentation
    this.validateInstrumentation();
  }

  /**
   * Instrument global AI functions for Edge Runtime
   */
  private instrumentGlobalFunctions(): void {
    this.log('Attempting global function patching...');
    
    if (typeof globalThis !== 'undefined') {
      // Try to patch global functions directly
      const functions = ['streamText', 'generateText', 'streamObject'];
      
      for (const funcName of functions) {
        const originalFunc = (globalThis as any)[funcName];
        if (originalFunc && typeof originalFunc === 'function') {
          this.log(`Found global ${funcName}, wrapping...`);
          (globalThis as any)[funcName] = this.wrapFunction(originalFunc, funcName);
        }
      }
    }
  }

  /**
   * Instrument global AI module for Edge Runtime
   */
  private instrumentGlobalAIFunctions(): void {
    this.log('Attempting global AI module instrumentation...');
    
    const aiModule = this.getAIModuleFromGlobal();
    if (aiModule) {
      this.log('Found AI module in global scope, instrumenting...');
      this.instrumentModule(aiModule);
    } else {
      this.log('No AI module found in global scope');
    }
  }

  /**
   * Get AI module from global scope
   */
  private getAIModuleFromGlobal(): any {
    // Try multiple ways to access AI SDK in Edge runtime
    if (typeof globalThis !== 'undefined' && (globalThis as any).ai) {
      return (globalThis as any).ai;
    }
    if (typeof global !== 'undefined' && (global as any).ai) {
      return (global as any).ai;
    }
    if (typeof window !== 'undefined' && (window as any).ai) {
      return (window as any).ai;
    }
    return null;
  }

  /**
   * Setup call site instrumentation for Edge Runtime
   */
  private setupCallSiteInstrumentation(): void {
    this.log('Setting up call site instrumentation...');
    
    // This would be implemented to intercept AI SDK calls at the call site
    // For now, we'll use a proxy-based approach
    this.setupProxyInstrumentation();
  }

  /**
   * Setup proxy-based instrumentation
   */
  private setupProxyInstrumentation(): void {
    this.log('Setting up proxy-based instrumentation...');
    
    // Create a proxy that intercepts AI SDK calls
    if (typeof globalThis !== 'undefined') {
      const originalAI = (globalThis as any).ai;
      if (originalAI) {
        (globalThis as any).ai = new Proxy(originalAI, {
          get: (target, prop) => {
            const original = target[prop];
            if (typeof original === 'function' && ['streamText', 'generateText', 'streamObject'].includes(prop as string)) {
              return this.wrapFunction(original, prop as string);
            }
            return original;
          }
        });
      }
    }
  }

  /**
   * Wrap a function with telemetry collection
   */
  private wrapFunction(originalFunc: any, functionName: string): any {
    if (functionName === 'streamText') {
      return this.wrapStreamText(originalFunc);
    } else if (functionName === 'generateText') {
      return this.wrapGenerateText(originalFunc);
    } else if (functionName === 'streamObject') {
      return this.wrapStreamObject(originalFunc);
    }
    return originalFunc;
  }

  /**
   * Try dynamic import as fallback
   */
  private tryDynamicImport(): void {
    this.log('Attempting dynamic import...');
    
    try {
      const dynamicImport = eval('import');
      dynamicImport('ai')
        .then((mod: any) => {
          this.log('Dynamic import successful');
          this.aiModule = mod;
          this.instrumentModule(mod);
        })
        .catch((error: any) => {
          this.log(`Dynamic import failed: ${error.message}`);
          this.tryAlternativeStrategies();
        });
    } catch (error) {
      this.log(`Dynamic import setup failed: ${(error as Error).message}`);
      this.tryAlternativeStrategies();
    }
  }

  /**
   * Try alternative strategies when standard methods fail
   */
  private tryAlternativeStrategies(): void {
    this.log('Trying alternative instrumentation strategies...');
    
    // Strategy 1: Check if AI SDK is already loaded
    if (this.checkForPreloadedAI()) {
      return;
    }
    
    // Strategy 2: Use function wrapping at call site
    this.setupCallSiteInstrumentation();
    
    // Strategy 3: Use proxy-based instrumentation
    this.setupProxyInstrumentation();
  }

  /**
   * Check for preloaded AI functions
   */
  private checkForPreloadedAI(): boolean {
    this.log('Checking for preloaded AI functions...');
    
    const possibleLocations = [
      (globalThis as any).ai,
      (globalThis as any).streamText,
      (globalThis as any).generateText,
      (globalThis as any).streamObject,
    ];
    
    for (const location of possibleLocations) {
      if (location && typeof location === 'function') {
        this.log('Found preloaded AI function, instrumenting...');
        this.instrumentPreloadedFunction(location);
        return true;
      }
    }
    return false;
  }

  /**
   * Instrument preloaded function
   */
  private instrumentPreloadedFunction(func: any): void {
    // This would instrument the preloaded function
    this.log('Instrumenting preloaded function...');
    
    // Replace the function in place
    const wrapped = this.wrapGenerateText(func);
    func = wrapped;
    
    // If there's a require cache, update it there too
    this.updateRequireCache('generateText', wrapped);
  }

  /**
   * Instrument AI module functions by replacing them with wrapped versions
   */
  private instrumentModule(module: any): void {
    let instrumentedCount = 0;
    
    if (module?.streamText && typeof module.streamText === 'function') {
      this.originalStreamText = module.streamText;
      const wrapped = this.wrapStreamText(module.streamText);
      
      // Replace the function in place
      module.streamText = wrapped;
      
      // If there's a require cache, update it there too
      this.updateRequireCache('streamText', wrapped);
      
      this.log('Instrumented streamText');
      instrumentedCount++;
    }
    
    if (module?.generateText && typeof module.generateText === 'function') {
      this.originalGenerateText = module.generateText;
      const wrapped = this.wrapGenerateText(module.generateText);
      
      module.generateText = wrapped;
      this.updateRequireCache('generateText', wrapped);
      
      this.log('Instrumented generateText');
      instrumentedCount++;
    }
    
    if (module?.streamObject && typeof module.streamObject === 'function') {
      this.originalStreamObject = module.streamObject;
      const wrapped = this.wrapStreamObject(module.streamObject);
      
      module.streamObject = wrapped;
      this.updateRequireCache('streamObject', wrapped);
      
      this.log('✅ Instrumented streamObject');
      instrumentedCount++;
    }
    
    if (instrumentedCount > 0) {
      this.log(`🎉 Successfully instrumented ${instrumentedCount} AI SDK function(s)`);
      this.instrumentationValidated = true;
    } else {
      this.log('⚠️  No AI SDK functions found to instrument');
    }
  }

  /**
   * Update the require cache with wrapped functions
   */
  private updateRequireCache(functionName: string, wrappedFunction: any): void {
    try {
      const aiModulePath = require.resolve('ai');
      const cachedModule = require.cache[aiModulePath];
      
      if (cachedModule && cachedModule.exports && cachedModule.exports[functionName]) {
        cachedModule.exports[functionName] = wrappedFunction;
        this.log(`Updated ${functionName} in require cache`);
      }
    } catch (error) {
      // Silently fail - not critical
    }
  }

  /**
   * Validate instrumentation
   */
  private validateInstrumentation(): boolean {
    if (this.isEdgeRuntime()) {
      return this.validateEdgeRuntimeInstrumentation();
    }
    return this.validateStandardInstrumentation();
  }

  /**
   * Validate Edge Runtime instrumentation
   */
  private validateEdgeRuntimeInstrumentation(): boolean {
    this.log('Validating Edge runtime instrumentation...');
    
    const hasStreamText = typeof (globalThis as any).streamText === 'function';
    const hasGenerateText = typeof (globalThis as any).generateText === 'function';
    const hasStreamObject = typeof (globalThis as any).streamObject === 'function';
    
    this.log(`Edge runtime validation: streamText=${hasStreamText}, generateText=${hasGenerateText}, streamObject=${hasStreamObject}`);
    
    const isValid = hasStreamText || hasGenerateText || hasStreamObject;
    this.instrumentationValidated = isValid;
    
    if (!isValid) {
      this.log('Warning: Edge runtime instrumentation validation failed');
    }
    
    return isValid;
  }

  /**
   * Validate standard instrumentation
   */
  private validateStandardInstrumentation(): boolean {
    this.log('Validating standard instrumentation...');
    
    const isValid = !!(this.originalStreamText || this.originalGenerateText || this.originalStreamObject);
    this.instrumentationValidated = isValid;
    
    if (!isValid) {
      this.log('Warning: Standard instrumentation validation failed');
    }
    
    return isValid;
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

      // Restore global functions
      if (typeof globalThis !== 'undefined') {
        // This would restore global functions if they were patched
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