import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { v4 as uuidv4 } from 'uuid';
import { 
  TelemetryConfig, 
  AITelemetryData, 
  TelemetryBatch, 
  Span, 
  SpanAttributes 
} from './types';
import { TelemetrySender } from './telemetry-sender';
import { SpanProcessor } from './span-processor';
import { AISDKIntegration } from './ai-sdk-integration';

export class AITelemetryCollector {
  private config: TelemetryConfig;
  private sender: TelemetrySender;
  private processor: SpanProcessor;
  private aiSdkIntegration: AISDKIntegration;
  private isEnabled: boolean = false;
  private spanProcessor: any;

  constructor(config: TelemetryConfig) {
    this.config = {
      batchSize: 10,
      batchTimeout: 5000,
      debug: false,
      retry: {
        maxAttempts: 3,
        delayMs: 1000,
      },
      enableAISDKIntegration: true,
      autoDetectAI: true,
      capturePrompts: true,
      captureResponses: true,
      captureSystemPrompt: true,
      maxContentLength: 10000,
      redactSensitiveData: false,
      edgeRuntimeStrategy: 'auto',
      enableEdgeRuntimeFallback: true,
      edgeRuntimeInstrumentation: {
        useGlobalPatching: true,
        useProxyWrapping: true,
        useCallSiteInstrumentation: true,
      },
      ...config,
    };

    this.sender = new TelemetrySender(this.config);
    this.processor = new SpanProcessor();
    this.aiSdkIntegration = new AISDKIntegration(this);
  }

  /**
   * Enable telemetry collection by setting up OpenTelemetry span processor
   */
  enable(): void {
    if (this.isEnabled) {
      this.log('Telemetry collection is already enabled');
      return;
    }

    try {
      // Create a custom span processor that will intercept all spans
      this.spanProcessor = new CustomSpanProcessor(this);
      
      // Register the processor with OpenTelemetry
      const tracerProvider = trace.getTracerProvider();
      if (tracerProvider && 'addSpanProcessor' in tracerProvider) {
        (tracerProvider as any).addSpanProcessor(this.spanProcessor);
        this.log('Telemetry collection enabled successfully');
      } else {
        this.log('Warning: Could not register span processor - telemetry may not be collected');
      }
      
      // Enable AI SDK integration if configured
      if (this.config.enableAISDKIntegration) {
        this.aiSdkIntegration.enable();
      }
      
      // Mark as enabled regardless so library features are usable (helps in tests and non-OTel environments)
      this.isEnabled = true;
    } catch (error) {
      this.log(`Error enabling telemetry collection: ${error}`);
    }
  }

  /**
   * Disable telemetry collection
   */
  disable(): void {
    if (!this.isEnabled) {
      return;
    }

    try {
      if (this.spanProcessor) {
        const tracerProvider = trace.getTracerProvider();
        if (tracerProvider && 'removeSpanProcessor' in tracerProvider) {
          (tracerProvider as any).removeSpanProcessor(this.spanProcessor);
        }
      }
      
      // Disable AI SDK integration
      this.aiSdkIntegration.disable();
      
      this.isEnabled = false;
      this.log('Telemetry collection disabled');
    } catch (error) {
      this.log(`Error disabling telemetry collection: ${error}`);
    }
  }

  /**
   * Process a span and extract telemetry data
   */
  async processSpan(span: Span): Promise<void> {
    try {
      // Check if this is an AI SDK span
      if (!this.isAISDKSpan(span)) {
        return;
      }

      const telemetryData = this.processor.extractTelemetryData(span);
      if (telemetryData) {
        await this.sender.sendTelemetry(telemetryData);
      }
    } catch (error) {
      this.log(`Error processing span: ${error}`);
    }
  }

  /**
   * Check if a span is from AI SDK
   */
  private isAISDKSpan(span: Span): boolean {
    const attributes = span.attributes;
    
    // Check for AI SDK specific attributes
    return !!(
      attributes['ai.telemetry.functionId'] ||
      attributes['ai.model.id'] ||
      attributes['ai.usage.promptTokens'] ||
      attributes['ai.usage.completionTokens']
    );
  }

  /**
   * Manually send telemetry data (useful for testing or custom events)
   */
  async sendCustomTelemetry(data: Partial<AITelemetryData>): Promise<void> {
    const telemetryData: AITelemetryData = {
      id: uuidv4(),
      functionId: data.functionId || 'custom',
      model: data.model || { id: 'unknown', provider: 'unknown' },
      usage: data.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      performance: data.performance || {},
      tools: data.tools || [],
      settings: data.settings || {},
      metadata: data.metadata || {},
      timestamp: data.timestamp || new Date().toISOString(),
      spanContext: data.spanContext || {
        traceId: 'custom',
        spanId: 'custom',
      },
    };

    await this.sender.sendTelemetry(telemetryData);
    // In debug mode, flush immediately to aid development and tests
    if (this.config.debug) {
      await this.sender.forceFlush();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): TelemetryConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<TelemetryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.sender.updateConfig(this.config);
  }

  /**
   * Enable automatic AI SDK integration
   */
  enableAISDKIntegration(): void {
    this.aiSdkIntegration.enable();
  }

  /**
   * Disable automatic AI SDK integration
   */
  disableAISDKIntegration(): void {
    this.aiSdkIntegration.disable();
  }

  /**
   * Check if AI SDK integration is enabled
   */
  isAISDKIntegrationEnabled(): boolean {
    return this.aiSdkIntegration.isIntegrationEnabled();
  }

  /**
   * Wrap an AI SDK function to automatically capture telemetry.
   * This is the primary method for automatic instrumentation.
   * 
   * @example
   * ```typescript
   * import { streamText } from 'ai';
   * import { telemetry } from './telemetry-collector';
   * 
   * const instrumentedStreamText = telemetry.wrap(streamText);
   * 
   * // Use the instrumented version everywhere
   * const result = await instrumentedStreamText({
   *   model: openai('gpt-4o'),
   *   messages: [{ role: 'user', content: 'Hello!' }]
   * });
   * ```
   * 
   * @param aiFunction - The AI SDK function to wrap (streamText, generateText, streamObject)
   * @returns Wrapped function that automatically captures telemetry
   */
  wrap<T extends Function>(aiFunction: T): T {
    return this.aiSdkIntegration.wrapAIFunction(aiFunction) as T;
  }

  /**
   * Get current status
   */
  getStatus(): { 
    enabled: boolean; 
    isConnected: boolean; 
    aiSdkIntegration: boolean; 
  } {
    return {
      enabled: this.isEnabled,
      isConnected: this.sender.isConnected(),
      aiSdkIntegration: this.aiSdkIntegration.isIntegrationEnabled(),
    };
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    this.disable();
    await this.sender.destroy();
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[AITelemetryCollector] ${message}`);
    }
  }
}

/**
 * Custom span processor that intercepts spans and forwards them to our collector
 */
class CustomSpanProcessor {
  private collector: AITelemetryCollector;

  constructor(collector: AITelemetryCollector) {
    this.collector = collector;
  }

  onStart(span: any, context: any): void {
    // Called when a span starts - we don't need to do anything here
  }

  onEnd(span: any): void {
    // Called when a span ends - process it for telemetry
    this.collector.processSpan(span as Span);
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}
