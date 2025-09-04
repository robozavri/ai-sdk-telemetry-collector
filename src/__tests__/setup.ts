// Test setup file for Jest

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
global.testUtils = {
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
