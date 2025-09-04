export interface TelemetryConfig {
  /** Remote server URL to send telemetry data to */
  serverUrl: string;
  /** API key for authentication (optional) */
  apiKey?: string;
  /** Batch size for sending data (default: 10) */
  batchSize?: number;
  /** Batch timeout in milliseconds (default: 5000) */
  batchTimeout?: number;
  /** Whether to enable debug logging */
  debug?: boolean;
  /** Custom headers to include in requests */
  headers?: Record<string, string>;
  /** Retry configuration */
  retry?: {
    maxAttempts: number;
    delayMs: number;
  };
}

export interface AITelemetryData {
  /** Unique identifier for the telemetry event */
  id: string;
  /** Function ID from AI SDK telemetry */
  functionId: string;
  /** Model information */
  model: {
    id: string;
    provider: string;
    responseModel?: string;
  };
  /** Token usage statistics */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Performance metrics */
  performance: {
    msToFirstChunk?: number;
    msToFinish?: number;
    avgCompletionTokensPerSecond?: number;
  };
  /** Tool usage information */
  tools: Array<{
    name: string;
    duration: number;
    success: boolean;
    arguments?: any;
    result?: any;
  }>;
  /** Request settings */
  settings: {
    maxOutputTokens?: number;
    maxRetries?: number;
    temperature?: number;
  };
  /** Custom metadata */
  metadata: Record<string, any>;
  /** Timestamp of the event */
  timestamp: string;
  /** Span context information */
  spanContext: {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
  };
}

export interface TelemetryBatch {
  /** Batch identifier */
  batchId: string;
  /** Array of telemetry events */
  events: AITelemetryData[];
  /** Batch timestamp */
  timestamp: string;
  /** Batch size */
  size: number;
}

export interface TelemetryResponse {
  /** Success status */
  success: boolean;
  /** Response message */
  message: string;
  /** Number of events processed */
  processed: number;
  /** Any additional data */
  data?: any;
}

export interface SpanAttributes {
  [key: string]: any;
}

export interface Span {
  attributes: SpanAttributes;
  spanContext: () => {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
  };
  name: string;
  kind: number;
  status: {
    code: number;
    message?: string;
  };
  startTime: [number, number];
  endTime: [number, number];
  events: Array<{
    name: string;
    attributes: SpanAttributes;
    time: [number, number];
  }>;
}
