import { AITelemetryCollector } from '../src/index';

// Example: Basic telemetry collection setup
async function basicExample() {
  // Initialize the telemetry collector
  const collector = new AITelemetryCollector({
    serverUrl: 'https://your-analytics-server.com',
    apiKey: process.env.TELEMETRY_API_KEY,
    debug: true,
    batchSize: 5,
    batchTimeout: 3000,
  });

  try {
    // Enable telemetry collection
    collector.enable();
    console.log('Telemetry collection enabled');

    // Check status
    const status = collector.getStatus();
    console.log('Collection status:', status);

    // Test connection to remote server
    const isConnected = await collector.sender.testConnection();
    console.log('Server connection:', isConnected ? 'OK' : 'Failed');

    // Send some custom telemetry data for testing
    await collector.sendCustomTelemetry({
      functionId: 'example-function',
      model: { id: 'example-model', provider: 'example' },
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      metadata: { example: true, timestamp: Date.now() },
    });

    console.log('Custom telemetry sent successfully');

    // Wait a bit to see batching in action
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Force flush any remaining data
    await collector.sender.forceFlush();
    console.log('Forced flush completed');

  } catch (error) {
    console.error('Error in basic example:', error);
  } finally {
    // Cleanup
    await collector.destroy();
    console.log('Collector destroyed');
  }
}

// Example: Configuration updates
async function configurationExample() {
  const collector = new AITelemetryCollector({
    serverUrl: 'https://your-analytics-server.com',
    debug: true,
  });

  collector.enable();

  // Update configuration dynamically
  collector.updateConfig({
    batchSize: 20,
    batchTimeout: 10000,
    retry: {
      maxAttempts: 5,
      delayMs: 2000,
    },
  });

  console.log('Updated configuration:', collector.getConfig());

  await collector.destroy();
}

// Example: Error handling and monitoring
async function monitoringExample() {
  const collector = new AITelemetryCollector({
    serverUrl: 'https://your-analytics-server.com',
    debug: true,
  });

  collector.enable();

  // Monitor connection status
  setInterval(() => {
    const status = collector.getStatus();
    const connectionStatus = collector.sender.getConnectionStatus();
    
    console.log('Status:', {
      enabled: status.enabled,
      connected: status.isConnected,
      connectionStatus: connectionStatus.status,
      batchSize: connectionStatus.batchSize,
      lastError: connectionStatus.lastError?.message,
    });
  }, 2000);

  // Wait for some time to see monitoring in action
  await new Promise(resolve => setTimeout(resolve, 10000));

  await collector.destroy();
}

// Run examples
if (require.main === module) {
  console.log('Running basic example...');
  basicExample()
    .then(() => {
      console.log('Basic example completed');
      return configurationExample();
    })
    .then(() => {
      console.log('Configuration example completed');
      return monitoringExample();
    })
    .then(() => {
      console.log('All examples completed');
    })
    .catch(console.error);
}

export { basicExample, configurationExample, monitoringExample };
