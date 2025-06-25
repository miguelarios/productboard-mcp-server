import { jest } from '@jest/globals';
import { ProductboardAPIClient } from '@api/client';
import { AuthManager } from '@auth/auth-manager';
import { ToolRegistry } from '@core/tool-registry';

export function createMockAPIClient(): jest.Mocked<ProductboardAPIClient> {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    request: jest.fn(),
    setAuthManager: jest.fn(),
    getBaseURL: jest.fn().mockReturnValue('https://api.productboard.com'),
  } as unknown as jest.Mocked<ProductboardAPIClient>;
}

export function createMockAuthManager(): jest.Mocked<AuthManager> {
  return {
    getAuthHeaders: jest.fn().mockResolvedValue({
      Authorization: 'Bearer test-token',
    }),
    refreshToken: jest.fn().mockResolvedValue(true),
    isAuthenticated: jest.fn().mockReturnValue(true),
    getAuthType: jest.fn().mockReturnValue('bearer'),
  } as unknown as jest.Mocked<AuthManager>;
}

export function createTestRegistry(): ToolRegistry {
  return new ToolRegistry();
}

export function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = async () => {
      try {
        if (await condition()) {
          resolve();
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          reject(new Error('Condition timeout'));
          return;
        }
        
        setTimeout(check, interval);
      } catch (error) {
        reject(error);
      }
    };
    
    check();
  });
}

export function generateTestFeature(overrides = {}) {
  return {
    name: `Test Feature ${Date.now()}`,
    description: 'Auto-generated test feature',
    status: 'new',
    priority: 'medium',
    tags: ['test'],
    ...overrides,
  };
}

export function assertFeatureStructure(feature: any) {
  expect(feature).toHaveProperty('id');
  expect(feature).toHaveProperty('name');
  expect(feature).toHaveProperty('description');
  expect(feature).toHaveProperty('status');
  expect(feature).toHaveProperty('created_at');
  expect(feature).toHaveProperty('updated_at');
}

export class TestDataBuilder {
  private features: any[] = [];
  private products: any[] = [];
  
  addFeature(feature = {}) {
    const newFeature = generateTestFeature(feature);
    this.features.push(newFeature);
    return this;
  }
  
  addProduct(product = {}) {
    const newProduct = {
      name: `Test Product ${Date.now()}`,
      description: 'Auto-generated test product',
      ...product,
    };
    this.products.push(newProduct);
    return this;
  }
  
  getFeatures() {
    return [...this.features];
  }
  
  getProducts() {
    return [...this.products];
  }
  
  reset() {
    this.features = [];
    this.products = [];
    return this;
  }
}