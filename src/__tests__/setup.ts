// Test setup file for Jest

export {};

declare global {
  // eslint-disable-next-line no-var
  var testUtils: {
    waitFor: (ms: number) => Promise<void>;
    createMockSpan: (attributes?: any) => {
      attributes: any;
      spanContext: () => {
        traceId: string;
        spanId: string;
        parentSpanId: string;
      };
      name: string;
      kind: number;
      status: { code: number; message: string };
      startTime: [number, number];
      endTime: [number, number];
      events: any[];
    };
  };
}

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress console output during tests unless explicitly needed
  if (process.env.NODE_ENV === 'test') {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  }
});

afterAll(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global test utilities
globalThis.testUtils = {
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  createMockSpan: (attributes: any = {}) => ({
    attributes,
    spanContext: () => ({
      traceId: 'test-trace-id',
      spanId: 'test-span-id',
      parentSpanId: 'test-parent-span-id',
    }),
    name: 'test-span',
    kind: 1,
    status: { code: 1, message: 'OK' },
    startTime: [0, 0],
    endTime: [0, 0],
    events: [],
  }),
};
