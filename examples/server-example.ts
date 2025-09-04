import express from 'express';
import cors from 'cors';
import { TelemetryBatch, AITelemetryData } from '../src/types';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for demo purposes
const telemetryData: AITelemetryData[] = [];
const batches: TelemetryBatch[] = [];

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    dataCount: telemetryData.length,
    batchCount: batches.length
  });
});

// Telemetry endpoint
app.post('/api/telemetry', (req, res) => {
  try {
    const batch: TelemetryBatch = req.body;
    
    // Validate batch structure
    if (!batch.batchId || !Array.isArray(batch.events)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid batch format' 
      });
    }

    console.log(`Received telemetry batch: ${batch.batchId} with ${batch.events.length} events`);
    
    // Store the batch
    batches.push(batch);
    
    // Store individual events
    telemetryData.push(...batch.events);
    
    // Log some key metrics
    const totalTokens = batch.events.reduce((sum, event) => sum + event.usage.totalTokens, 0);
    const avgResponseTime = batch.events.reduce((sum, event) => {
      return sum + (event.performance.msToFinish || 0);
    }, 0) / batch.events.length;
    
    console.log(`Batch metrics: ${totalTokens} total tokens, ${avgResponseTime.toFixed(2)}ms avg response time`);
    
    res.json({
      success: true,
      message: 'Telemetry batch received successfully',
      processed: batch.events.length,
      batchId: batch.batchId,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Error processing telemetry batch:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Analytics endpoints
app.get('/api/analytics/summary', (req, res) => {
  if (telemetryData.length === 0) {
    return res.json({
      totalEvents: 0,
      message: 'No telemetry data available'
    });
  }

  // Calculate summary statistics
  const totalTokens = telemetryData.reduce((sum, event) => sum + event.usage.totalTokens, 0);
  const totalPromptTokens = telemetryData.reduce((sum, event) => sum + event.usage.promptTokens, 0);
  const totalCompletionTokens = telemetryData.reduce((sum, event) => sum + event.usage.completionTokens, 0);
  
  const avgResponseTime = telemetryData.reduce((sum, event) => {
    return sum + (event.performance.msToFinish || 0);
  }, 0) / telemetryData.length;
  
  const avgTokensPerSecond = telemetryData.reduce((sum, event) => {
    return sum + (event.performance.avgCompletionTokensPerSecond || 0);
  }, 0) / telemetryData.length;

  // Group by function
  const functionBreakdown = telemetryData.reduce((acc, event) => {
    acc[event.functionId] = (acc[event.functionId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Group by model
  const modelBreakdown = telemetryData.reduce((acc, event) => {
    acc[event.model.id] = (acc[event.model.id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Tool usage analysis
  const toolUsage = telemetryData.reduce((acc, event) => {
    event.tools.forEach(tool => {
      if (!acc[tool.name]) {
        acc[tool.name] = { total: 0, success: 0, totalDuration: 0 };
      }
      acc[tool.name].total++;
      if (tool.success) acc[tool.name].success++;
      acc[tool.name].totalDuration += tool.duration;
    });
    return acc;
  }, {} as Record<string, { total: number; success: number; totalDuration: number }>);

  // Calculate tool success rates
  const toolSuccessRates = Object.entries(toolUsage).reduce((acc, [toolName, stats]) => {
    acc[toolName] = {
      total: stats.total,
      successRate: (stats.success / stats.total) * 100,
      avgDuration: stats.totalDuration / stats.total,
    };
    return acc;
  }, {} as Record<string, { total: number; successRate: number; avgDuration: number }>);

  res.json({
    totalEvents: telemetryData.length,
    totalTokens: {
      total: totalTokens,
      prompt: totalPromptTokens,
      completion: totalCompletionTokens,
    },
    performance: {
      avgResponseTime: Math.round(avgResponseTime),
      avgTokensPerSecond: Math.round(avgTokensPerSecond * 100) / 100,
    },
    functionBreakdown,
    modelBreakdown,
    toolSuccessRates,
    timeRange: {
      start: telemetryData[0]?.timestamp,
      end: telemetryData[telemetryData.length - 1]?.timestamp,
    },
  });
});

// Get recent events
app.get('/api/analytics/recent', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const recentEvents = telemetryData
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
  
  res.json({
    events: recentEvents,
    total: recentEvents.length,
    limit,
  });
});

// Get events by function
app.get('/api/analytics/function/:functionId', (req, res) => {
  const { functionId } = req.params;
  const functionEvents = telemetryData.filter(event => event.functionId === functionId);
  
  if (functionEvents.length === 0) {
    return res.status(404).json({ 
      success: false, 
      message: `No events found for function: ${functionId}` 
    });
  }
  
  res.json({
    functionId,
    events: functionEvents,
    total: functionEvents.length,
  });
});

// Get events by model
app.get('/api/analytics/model/:modelId', (req, res) => {
  const { modelId } = req.params;
  const modelEvents = telemetryData.filter(event => event.model.id === modelId);
  
  if (modelEvents.length === 0) {
    return res.status(404).json({ 
      success: false, 
      message: `No events found for model: ${modelId}` 
    });
  }
  
  res.json({
    modelId,
    events: modelEvents,
    total: modelEvents.length,
  });
});

// Clear data endpoint (for testing)
app.delete('/api/analytics/clear', (req, res) => {
  telemetryData.length = 0;
  batches.length = 0;
  res.json({ 
    success: true, 
    message: 'All telemetry data cleared' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Telemetry server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Telemetry endpoint: http://localhost:${PORT}/api/telemetry`);
  console.log(`Analytics: http://localhost:${PORT}/api/analytics/summary`);
});

export default app;
