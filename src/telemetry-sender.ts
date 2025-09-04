import { v4 as uuidv4 } from 'uuid';
import { 
  TelemetryConfig, 
  AITelemetryData, 
  TelemetryBatch, 
  TelemetryResponse 
} from './types';

export class TelemetrySender {
  private config: TelemetryConfig;
  private batch: AITelemetryData[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isDestroyed: boolean = false;
  private connectionStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
  private lastError: Error | null = null;

  constructor(config: TelemetryConfig) {
    this.config = config;
    this.setupBatchProcessing();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: TelemetryConfig): void {
    this.config = { ...this.config, ...newConfig };
    this.setupBatchProcessing();
  }

  /**
   * Send telemetry data (will be batched)
   */
  async sendTelemetry(data: AITelemetryData): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('TelemetrySender has been destroyed');
    }

    this.batch.push(data);

    // Send immediately if batch is full
    if (this.batch.length >= this.config.batchSize!) {
      await this.flushBatch();
    }
  }

  /**
   * Setup batch processing with timer
   */
  private setupBatchProcessing(): void {
    // Clear existing timer
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    // Set new timer
    this.batchTimer = setInterval(async () => {
      if (this.batch.length > 0) {
        await this.flushBatch();
      }
    }, this.config.batchTimeout);
  }

  /**
   * Flush current batch to remote server
   */
  private async flushBatch(): Promise<void> {
    if (this.batch.length === 0) return;

    const batchToSend = [...this.batch];
    this.batch = [];

    try {
      await this.sendBatch(batchToSend);
      this.connectionStatus = 'connected';
      this.lastError = null;
    } catch (error) {
      this.connectionStatus = 'error';
      this.lastError = error as Error;
      
      // Log error if debug is enabled
      if (this.config.debug) {
        console.error('Error sending telemetry batch:', error);
      }

      // Optionally retry failed batches
      await this.retryBatch(batchToSend);
    }
  }

  /**
   * Send batch to remote server
   */
  private async sendBatch(events: AITelemetryData[]): Promise<TelemetryResponse> {
    const batch: TelemetryBatch = {
      batchId: uuidv4(),
      events,
      timestamp: new Date().toISOString(),
      size: events.length,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ai-sdk-telemetry-collector/1.0.0',
      ...this.config.headers,
    };

    // Add API key if provided
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(`${this.config.serverUrl}/api/telemetry`, {
      method: 'POST',
      headers,
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json() as TelemetryResponse;
    return result;
  }

  /**
   * Retry failed batch with exponential backoff
   */
  private async retryBatch(events: AITelemetryData[]): Promise<void> {
    const maxAttempts = this.config.retry?.maxAttempts || 3;
    const baseDelay = this.config.retry?.delayMs || 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Wait before retry (exponential backoff)
        if (attempt > 1) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        await this.sendBatch(events);
        this.connectionStatus = 'connected';
        this.lastError = null;
        return; // Success, exit retry loop
      } catch (error) {
        this.lastError = error as Error;
        
        if (this.config.debug) {
          console.error(`Retry attempt ${attempt} failed:`, error);
        }

        // If this was the last attempt, give up
        if (attempt === maxAttempts) {
          this.connectionStatus = 'error';
          if (this.config.debug) {
            console.error(`Failed to send telemetry after ${maxAttempts} attempts`);
          }
        }
      }
    }
  }

  /**
   * Force flush current batch
   */
  async forceFlush(): Promise<void> {
    if (this.batch.length > 0) {
      await this.flushBatch();
    }
  }

  /**
   * Get current connection status
   */
  isConnected(): boolean {
    return this.connectionStatus === 'connected';
  }

  /**
   * Get connection status details
   */
  getConnectionStatus(): {
    status: 'connected' | 'disconnected' | 'error';
    lastError: Error | null;
    batchSize: number;
  } {
    return {
      status: this.connectionStatus,
      lastError: this.lastError,
      batchSize: this.batch.length,
    };
  }

  /**
   * Test connection to remote server
   */
  async testConnection(): Promise<boolean> {
    try {
      const headers: Record<string, string> = {
        'User-Agent': 'ai-sdk-telemetry-collector/1.0.0',
        ...this.config.headers,
      };

      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(`${this.config.serverUrl}/health`, {
        method: 'GET',
        headers,
      });

      const isHealthy = response.ok;
      this.connectionStatus = isHealthy ? 'connected' : 'error';
      return isHealthy;
    } catch (error) {
      this.connectionStatus = 'error';
      this.lastError = error as Error;
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    this.isDestroyed = true;

    // Clear timer
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    // Force flush any remaining data
    await this.forceFlush();
  }
}
