import { jest } from '@jest/globals';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Global test setup
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce noise in tests
});

// Reset mocks after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

// Increase timeout for integration/e2e tests
if (process.env.TEST_TYPE === 'integration' || process.env.TEST_TYPE === 'e2e') {
  jest.setTimeout(30000);
}

// Mock external dependencies that shouldn't be called in tests
// Note: Add specific mocks here as needed

// Global error handler for unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection in test:', error);
  throw error;
});