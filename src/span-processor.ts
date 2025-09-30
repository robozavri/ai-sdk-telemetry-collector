import { v4 as uuidv4 } from 'uuid';
import { AITelemetryData, Span, SpanAttributes } from './types';

export class SpanProcessor {
  /**
   * Extract telemetry data from an OpenTelemetry span
   */
  extractTelemetryData(span: Span): AITelemetryData | null {
    try {
      const attributes = span.attributes;
      const spanCtx = span.spanContext();

      // Extract basic information
      const functionId = attributes['ai.telemetry.functionId'] as string;
      if (!functionId) {
        return null; // Not an AI SDK span
      }

      // Extract model information
      const modelId = attributes['ai.model.id'] as string;
      const provider = attributes['ai.model.provider'] as string;
      const responseModel = attributes['ai.response.model'] as string;

      // Extract usage statistics
      const promptTokens = (attributes['ai.usage.promptTokens'] as number) || 0;
      const completionTokens = (attributes['ai.usage.completionTokens'] as number) || 0;
      const totalTokens = promptTokens + completionTokens;

      // Extract performance metrics
      const msToFirstChunk = attributes['ai.response.msToFirstChunk'] as number;
      const msToFinish = attributes['ai.response.msToFinish'] as number;
      const avgCompletionTokensPerSecond = attributes['ai.response.avgCompletionTokensPerSecond'] as number;

      // Extract settings
      const maxOutputTokens = attributes['ai.settings.maxOutputTokens'] as number;
      const maxRetries = attributes['ai.settings.maxRetries'] as number;
      const temperature = attributes['ai.settings.temperature'] as number;

      // Extract tool information from span events
      const tools = this.extractToolInformation(span);

      // Extract custom metadata
      const metadata = this.extractMetadata(attributes);

      return {
        id: uuidv4(),
        functionId,
        model: {
          id: modelId || 'unknown',
          provider: provider || 'unknown',
          responseModel,
        },
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
        },
        performance: {
          msToFirstChunk,
          msToFinish,
          avgCompletionTokensPerSecond,
        },
        tools,
        settings: {
          maxOutputTokens,
          maxRetries,
          temperature,
        },
        metadata,
        timestamp: new Date().toISOString(),
        spanContext: {
          traceId: spanCtx.traceId,
          spanId: spanCtx.spanId,
          parentSpanId: spanCtx.parentSpanId,
        },
      };
    } catch (error) {
      console.error('Error extracting telemetry data from span:', error);
      return null;
    }
  }

  /**
   * Extract tool usage information from span events
   */
  private extractToolInformation(span: Span): Array<{
    name: string;
    duration: number;
    success: boolean;
    arguments?: any;
    result?: any;
  }> {
    const tools: Array<{
      name: string;
      duration: number;
      success: boolean;
      arguments?: any;
      result?: any;
    }> = [];

    try {
      // Look for tool call events
      for (const event of span.events) {
        if (event.name === 'ai.toolCall') {
          const toolName = event.attributes['ai.tool.name'] as string;
          const toolArgs = event.attributes['ai.tool.arguments'];
          const toolResult = event.attributes['ai.tool.result'];
          const toolSuccess = event.attributes['ai.tool.success'] as boolean;
          
          // Calculate duration (this is approximate since we only have event time)
          const duration = this.calculateEventDuration(event.time, span.startTime);

          tools.push({
            name: toolName || 'unknown',
            duration,
            success: toolSuccess !== false, // Default to true if not specified
            arguments: toolArgs,
            result: toolResult,
          });
        }
      }

      // Also look for tool-related spans by name
      if (span.name.includes('tool') || span.name.includes('function')) {
        const toolName = span.name;
        const duration = this.calculateSpanDuration(span);
        const success = span.status.code === 1;

        tools.push({
          name: toolName,
          duration,
          success,
        });
      }
    } catch (error) {
      console.error('Error extracting tool information:', error);
    }

    return tools;
  }

  /**
   * Extract custom metadata from span attributes
   */
  private extractMetadata(attributes: SpanAttributes): Record<string, any> {
    const metadata: Record<string, any> = {};

    try {
      // Extract all non-AI SDK attributes as metadata
      for (const [key, value] of Object.entries(attributes)) {
        if (!key.startsWith('ai.') && !key.startsWith('http.') && !key.startsWith('messaging.')) {
          metadata[key] = value;
        }
      }

      // Extract prompt and response if available (be careful with sensitive data)
      if (attributes['ai.prompt']) {
        metadata.hasPrompt = true;
        metadata.promptLength = String(attributes['ai.prompt']).length;
      }

      if (attributes['ai.response']) {
        metadata.hasResponse = true;
        metadata.responseLength = String(attributes['ai.response']).length;
      }

      // Extract user and session information if available
      if (attributes['ai.user.id']) {
        metadata.userId = attributes['ai.user.id'];
      }

      if (attributes['ai.session.id']) {
        metadata.sessionId = attributes['ai.session.id'];
      }

      // Extract website/application context if available
      if (attributes['ai.website.id']) {
        metadata.websiteId = attributes['ai.website.id'];
      }

      if (attributes['ai.application.id']) {
        metadata.applicationId = attributes['ai.application.id'];
      }
    } catch (error) {
      console.error('Error extracting metadata:', error);
    }

    return metadata;
  }

  /**
   * Calculate duration between two timestamps
   */
  private calculateEventDuration(eventTime: [number, number], startTime: [number, number]): number {
    try {
      const eventMs = eventTime[0] * 1000 + eventTime[1] / 1000000;
      const startMs = startTime[0] * 1000 + startTime[1] / 1000000;
      return Math.max(0, eventMs - startMs);
    } catch {
      return 0;
    }
  }

  /**
   * Calculate total span duration
   */
  private calculateSpanDuration(span: Span): number {
    try {
      const endMs = span.endTime[0] * 1000 + span.endTime[1] / 1000000;
      const startMs = span.startTime[0] * 1000 + span.startTime[1] / 1000000;
      return Math.max(0, endMs - startMs);
    } catch {
      return 0;
    }
  }
}
