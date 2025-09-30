import { AITelemetryData, TelemetryBatch } from './types';

/**
 * Generate a unique identifier
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Calculate the total tokens used across multiple telemetry events
 */
export function calculateTotalTokens(events: AITelemetryData[]): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  return events.reduce(
    (acc, event) => ({
      promptTokens: acc.promptTokens + event.usage.promptTokens,
      completionTokens: acc.completionTokens + event.usage.completionTokens,
      totalTokens: acc.totalTokens + event.usage.totalTokens,
    }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  );
}

/**
 * Calculate average response time across multiple events
 */
export function calculateAverageResponseTime(events: AITelemetryData[]): {
  avgMsToFirstChunk: number;
  avgMsToFinish: number;
  avgTokensPerSecond: number;
} {
  const validEvents = events.filter(
    (event) =>
      event.performance.msToFirstChunk !== undefined ||
      event.performance.msToFinish !== undefined ||
      event.performance.avgCompletionTokensPerSecond !== undefined
  );

  if (validEvents.length === 0) {
    return {
      avgMsToFirstChunk: 0,
      avgMsToFinish: 0,
      avgTokensPerSecond: 0,
    };
  }

  const totalFirstChunk = validEvents.reduce(
    (sum, event) => sum + (event.performance.msToFirstChunk || 0),
    0
  );
  const totalFinish = validEvents.reduce(
    (sum, event) => sum + (event.performance.msToFinish || 0),
    0
  );
  const totalTokensPerSecond = validEvents.reduce(
    (sum, event) => sum + (event.performance.avgCompletionTokensPerSecond || 0),
    0
  );

  return {
    avgMsToFirstChunk: totalFirstChunk / validEvents.length,
    avgMsToFinish: totalFinish / validEvents.length,
    avgTokensPerSecond: totalTokensPerSecond / validEvents.length,
  };
}

/**
 * Group telemetry events by function ID
 */
export function groupEventsByFunction(events: AITelemetryData[]): Record<string, AITelemetryData[]> {
  return events.reduce((groups, event) => {
    const functionId = event.functionId;
    if (!groups[functionId]) {
      groups[functionId] = [];
    }
    groups[functionId].push(event);
    return groups;
  }, {} as Record<string, AITelemetryData[]>);
}

/**
 * Group telemetry events by model
 */
export function groupEventsByModel(events: AITelemetryData[]): Record<string, AITelemetryData[]> {
  return events.reduce((groups, event) => {
    const modelId = event.model.id;
    if (!groups[modelId]) {
      groups[modelId] = [];
    }
    groups[modelId].push(event);
    return groups;
  }, {} as Record<string, AITelemetryData[]>);
}

/**
 * Filter events by time range
 */
export function filterEventsByTimeRange(
  events: AITelemetryData[],
  startTime: Date,
  endTime: Date
): AITelemetryData[] {
  return events.filter((event) => {
    const eventTime = new Date(event.timestamp);
    return eventTime >= startTime && eventTime <= endTime;
  });
}

/**
 * Calculate success rate for tool usage
 */
export function calculateToolSuccessRate(events: AITelemetryData[]): Record<string, number> {
  const toolStats: Record<string, { success: number; total: number }> = {};

  events.forEach((event) => {
    event.tools.forEach((tool) => {
      if (!toolStats[tool.name]) {
        toolStats[tool.name] = { success: 0, total: 0 };
      }
      toolStats[tool.name].total++;
      if (tool.success) {
        toolStats[tool.name].success++;
      }
    });
  });

  const successRates: Record<string, number> = {};
  Object.entries(toolStats).forEach(([toolName, stats]) => {
    successRates[toolName] = stats.total > 0 ? (stats.success / stats.total) * 100 : 0;
  });

  return successRates;
}

/**
 * Validate telemetry data structure
 */
export function validateTelemetryData(data: AITelemetryData): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.id) errors.push('Missing id');
  if (!data.functionId) errors.push('Missing functionId');
  if (!data.model?.id) errors.push('Missing model.id');
  if (!data.model?.provider) errors.push('Missing model.provider');
  if (typeof data.usage?.promptTokens !== 'number') errors.push('Invalid promptTokens');
  if (typeof data.usage?.completionTokens !== 'number') errors.push('Invalid completionTokens');
  if (!data.timestamp) errors.push('Missing timestamp');

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Create a summary report from telemetry events
 */
export function createTelemetrySummary(events: AITelemetryData[]): {
  totalEvents: number;
  totalTokens: { prompt: number; completion: number; total: number };
  averagePerformance: { firstChunk: number; finish: number; tokensPerSecond: number };
  functionBreakdown: Record<string, number>;
  modelBreakdown: Record<string, number>;
  toolSuccessRates: Record<string, number>;
  timeRange: { start: string; end: string };
} {
  if (events.length === 0) {
    return {
      totalEvents: 0,
      totalTokens: { prompt: 0, completion: 0, total: 0 },
      averagePerformance: { firstChunk: 0, finish: 0, tokensPerSecond: 0 },
      functionBreakdown: {},
      modelBreakdown: {},
      toolSuccessRates: {},
      timeRange: { start: '', end: '' },
    };
  }

  const totalTokensAgg = calculateTotalTokens(events);
  const averagePerformanceAgg = calculateAverageResponseTime(events);
  const functionBreakdown = groupEventsByFunction(events);
  const modelBreakdown = groupEventsByModel(events);
  const toolSuccessRates = calculateToolSuccessRate(events);

  const timestamps = events.map((e) => new Date(e.timestamp)).sort((a, b) => a.getTime() - b.getTime());
  const timeRange = {
    start: timestamps[0].toISOString(),
    end: timestamps[timestamps.length - 1].toISOString(),
  };

  return {
    totalEvents: events.length,
    totalTokens: {
      prompt: totalTokensAgg.promptTokens,
      completion: totalTokensAgg.completionTokens,
      total: totalTokensAgg.totalTokens,
    },
    averagePerformance: {
      firstChunk: averagePerformanceAgg.avgMsToFirstChunk,
      finish: averagePerformanceAgg.avgMsToFinish,
      tokensPerSecond: averagePerformanceAgg.avgTokensPerSecond,
    },
    functionBreakdown: Object.fromEntries(
      Object.entries(functionBreakdown).map(([key, value]) => [key, value.length])
    ),
    modelBreakdown: Object.fromEntries(
      Object.entries(modelBreakdown).map(([key, value]) => [key, value.length])
    ),
    toolSuccessRates,
    timeRange,
  };
}
