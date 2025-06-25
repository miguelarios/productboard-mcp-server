import { EventEmitter } from 'events';
import { MCPRequest, MCPResponse } from '../../../src/core/types.js';

/**
 * Mock MCP Server for testing MCP clients
 * Implements the MCP protocol without requiring actual server infrastructure
 */
export class MockMCPServer extends EventEmitter {
  private isConnected = false;
  private responseHandlers = new Map<string, (params?: unknown) => Promise<unknown>>();
  private toolRegistry = new Map<string, any>();
  private serverInfo = {
    name: 'mock-productboard-mcp',
    version: '1.0.0-test',
    protocolVersion: '2024-11-05',
  };

  constructor() {
    super();
    this.setupDefaultHandlers();
    this.setupProductboardTools();
  }

  private setupDefaultHandlers() {
    // Initialize request handler
    this.responseHandlers.set('initialize', async (_params) => {
      this.isConnected = true;
      return {
        protocolVersion: this.serverInfo.protocolVersion,
        capabilities: {
          tools: {},
        },
        serverInfo: this.serverInfo,
      };
    });

    // Tools list handler
    this.responseHandlers.set('tools/list', async () => {
      return {
        tools: Array.from(this.toolRegistry.values()),
      };
    });

    // Tools call handler
    this.responseHandlers.set('tools/call', async (params: any) => {
      const { name, arguments: toolArgs } = params;
      
      // Check if it's a custom handler first
      if (this.responseHandlers.has(name)) {
        const handler = this.responseHandlers.get(name);
        if (handler) {
          return await handler(toolArgs);
        }
      }
      
      const tool = this.toolRegistry.get(name);
      if (!tool) {
        throw new Error(`Tool not found: ${name}`);
      }

      // Simulate tool execution with mock data
      return this.executeMockTool(name, toolArgs);
    });

    // Ping handler
    this.responseHandlers.set('ping', async () => {
      return { status: 'pong' };
    });

    // Shutdown handler
    this.responseHandlers.set('shutdown', async () => {
      this.isConnected = false;
      return { status: 'shutdown' };
    });
  }

  private setupProductboardTools() {
    // Register mock Productboard tools
    const tools = [
      {
        name: 'pb_feature_create',
        description: 'Create a new feature',
        inputSchema: {
          type: 'object',
          required: ['name', 'description'],
          properties: {
            name: { type: 'string', description: 'Feature name' },
            description: { type: 'string', description: 'Feature description' },
            status: { type: 'string', enum: ['new', 'in_progress', 'done'], default: 'new' },
            productId: { type: 'string', description: 'Product ID' },
          },
        },
      },
      {
        name: 'pb_feature_list',
        description: 'List features',
        inputSchema: {
          type: 'object',
          properties: {
            productId: { type: 'string', description: 'Filter by product ID' },
            status: { type: 'string', description: 'Filter by status' },
            limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
            offset: { type: 'number', default: 0, minimum: 0 },
          },
        },
      },
      {
        name: 'pb_feature_get',
        description: 'Get feature by ID',
        inputSchema: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Feature ID' },
          },
        },
      },
      {
        name: 'pb_feature_update',
        description: 'Update a feature',
        inputSchema: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Feature ID' },
            name: { type: 'string', description: 'Feature name' },
            description: { type: 'string', description: 'Feature description' },
            status: { type: 'string', enum: ['new', 'in_progress', 'done'] },
          },
        },
      },
      {
        name: 'pb_product_list',
        description: 'List products',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
            offset: { type: 'number', default: 0, minimum: 0 },
          },
        },
      },
      {
        name: 'pb_user_current',
        description: 'Get current user information',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'pb_company_list',
        description: 'List companies',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
            offset: { type: 'number', default: 0, minimum: 0 },
          },
        },
      },
    ];

    tools.forEach(tool => {
      this.toolRegistry.set(tool.name, tool);
    });
  }

  private async executeMockTool(toolName: string, params: unknown): Promise<unknown> {
    // Simulate API delays
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

    switch (toolName) {
      case 'pb_feature_create':
        return this.mockFeatureCreate(params as any);
      case 'pb_feature_list':
        return this.mockFeatureList(params as any);
      case 'pb_feature_get':
        return this.mockFeatureGet(params as any);
      case 'pb_feature_update':
        return this.mockFeatureUpdate(params as any);
      case 'pb_product_list':
        return this.mockProductList(params as any);
      case 'pb_user_current':
        return this.mockCurrentUser();
      case 'pb_company_list':
        return this.mockCompanyList(params as any);
      default:
        throw new Error(`Mock implementation not found for tool: ${toolName}`);
    }
  }

  private mockFeatureCreate(params: { name: string; description: string; status?: string; productId?: string }) {
    const feature = {
      id: `feature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: params.name,
      description: params.description,
      status: params.status || 'new',
      productId: params.productId || 'product-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'user-test',
    };

    return {
      success: true,
      data: feature,
    };
  }

  private mockFeatureList(params: { productId?: string; status?: string; limit?: number; offset?: number } = {}) {
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    
    const features = Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
      id: `feature-${offset + i + 1}`,
      name: `Mock Feature ${offset + i + 1}`,
      description: `Description for mock feature ${offset + i + 1}`,
      status: ['new', 'in_progress', 'done'][i % 3],
      productId: params.productId || `product-${(i % 3) + 1}`,
      createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - i * 12 * 60 * 60 * 1000).toISOString(),
    }));

    return {
      success: true,
      data: features,
      pagination: {
        limit,
        offset,
        total: 50,
        hasMore: offset + limit < 50,
      },
    };
  }

  private mockFeatureGet(params: { id: string }) {
    const feature = {
      id: params.id,
      name: `Mock Feature ${params.id}`,
      description: `Detailed description for feature ${params.id}`,
      status: 'in_progress',
      productId: 'product-1',
      createdAt: '2023-01-15T10:00:00Z',
      updatedAt: '2023-01-20T14:30:00Z',
      createdBy: 'user-test',
      assignedTo: 'user-dev',
      tags: ['enhancement', 'user-requested'],
      priority: 'high',
    };

    return {
      success: true,
      data: feature,
    };
  }

  private mockFeatureUpdate(params: { id: string; name?: string; description?: string; status?: string }) {
    const feature = {
      id: params.id,
      name: params.name || `Updated Feature ${params.id}`,
      description: params.description || `Updated description for feature ${params.id}`,
      status: params.status || 'in_progress',
      productId: 'product-1',
      createdAt: '2023-01-15T10:00:00Z',
      updatedAt: new Date().toISOString(),
      updatedBy: 'user-test',
    };

    return {
      success: true,
      data: feature,
    };
  }

  private mockProductList(params: { limit?: number; offset?: number } = {}) {
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    
    const products = Array.from({ length: Math.min(limit, 3) }, (_, i) => ({
      id: `product-${offset + i + 1}`,
      name: `Mock Product ${offset + i + 1}`,
      description: `Description for mock product ${offset + i + 1}`,
      status: 'active',
      createdAt: new Date(Date.now() - (i + 1) * 30 * 24 * 60 * 60 * 1000).toISOString(),
      ownerId: 'user-test',
    }));

    return {
      success: true,
      data: products,
      pagination: {
        limit,
        offset,
        total: 10,
        hasMore: offset + limit < 10,
      },
    };
  }

  private mockCurrentUser() {
    return {
      success: true,
      data: {
        id: 'user-test-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        createdAt: '2022-01-01T00:00:00Z',
        lastLoginAt: new Date().toISOString(),
        preferences: {
          timezone: 'UTC',
          notifications: true,
        },
      },
    };
  }

  private mockCompanyList(params: { limit?: number; offset?: number } = {}) {
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    
    const companies = Array.from({ length: Math.min(limit, 4) }, (_, i) => ({
      id: `company-${offset + i + 1}`,
      name: `Mock Company ${offset + i + 1}`,
      domain: `company${offset + i + 1}.com`,
      industry: ['Technology', 'Healthcare', 'Finance', 'Education'][i % 4],
      size: ['Small', 'Medium', 'Large', 'Enterprise'][i % 4],
      createdAt: new Date(Date.now() - (i + 1) * 60 * 24 * 60 * 60 * 1000).toISOString(),
    }));

    return {
      success: true,
      data: companies,
      pagination: {
        limit,
        offset,
        total: 25,
        hasMore: offset + limit < 25,
      },
    };
  }

  /**
   * Send a request to the mock server
   */
  async sendRequest(request: MCPRequest): Promise<MCPResponse> {
    if (!this.isConnected && request.method !== 'initialize') {
      return {
        id: request.id,
        error: {
          code: -32002,
          message: 'Server not initialized',
        },
      };
    }

    const handler = this.responseHandlers.get(request.method);
    if (!handler) {
      return {
        id: request.id,
        error: {
          code: -32601,
          message: `Method not found: ${request.method}`,
        },
      };
    }

    try {
      const result = await handler(request.params);
      return {
        id: request.id,
        result,
      };
    } catch (error) {
      return {
        id: request.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
          data: error instanceof Error ? { stack: error.stack } : undefined,
        },
      };
    }
  }

  /**
   * Register a custom tool for testing
   */
  registerTool(tool: {
    name: string;
    description: string;
    inputSchema: unknown;
    handler: (params: unknown) => Promise<unknown>;
  }) {
    this.toolRegistry.set(tool.name, {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    });
    this.responseHandlers.set(tool.name, tool.handler);
  }

  /**
   * Register a custom request handler
   */
  setRequestHandler(method: string, handler: (params?: unknown) => Promise<unknown>) {
    this.responseHandlers.set(method, handler);
  }

  /**
   * Get server connection status
   */
  isServerConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get list of registered tools
   */
  getRegisteredTools(): string[] {
    return Array.from(this.toolRegistry.keys());
  }

  /**
   * Reset server state
   */
  reset() {
    this.isConnected = false;
    this.setupDefaultHandlers();
    this.setupProductboardTools();
  }

  /**
   * Simulate server errors for testing error handling
   */
  simulateError(method: string, error: Error) {
    this.responseHandlers.set(method, async () => {
      throw error;
    });
  }

  /**
   * Add latency to responses for performance testing
   */
  addLatency(method: string, delayMs: number) {
    if (method === 'pb_user_current') {
      // For tools, we need to wrap the execution
      const originalExecutor = this.executeMockTool.bind(this);
      this.executeMockTool = async (toolName: string, params: unknown) => {
        if (toolName === method) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        return originalExecutor(toolName, params);
      };
    } else {
      const originalHandler = this.responseHandlers.get(method);
      if (originalHandler) {
        this.responseHandlers.set(method, async (params) => {
          await new Promise(resolve => setTimeout(resolve, delayMs));
          return originalHandler(params);
        });
      }
    }
  }
}

describe('Mock MCP Server Tests', () => {
  let mockServer: MockMCPServer;

  beforeEach(() => {
    mockServer = new MockMCPServer();
  });

  describe('Server Initialization', () => {
    it('should initialize successfully', async () => {
      const request: MCPRequest = {
        id: '1',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: { roots: { listChanged: false }, sampling: {} },
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      };

      const response = await mockServer.sendRequest(request);

      expect(response.id).toBe('1');
      expect(response.result).toMatchObject({
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'mock-productboard-mcp',
          version: '1.0.0-test',
        },
      });
      expect(mockServer.isServerConnected()).toBe(true);
    });

    it('should reject requests before initialization', async () => {
      const request: MCPRequest = {
        id: '1',
        method: 'tools/list',
      };

      const response = await mockServer.sendRequest(request);

      expect(response.id).toBe('1');
      expect(response.error).toMatchObject({
        code: -32002,
        message: 'Server not initialized',
      });
    });
  });

  describe('Tools Management', () => {
    beforeEach(async () => {
      await mockServer.sendRequest({
        id: '1',
        method: 'initialize',
        params: {},
      });
    });

    it('should list available tools', async () => {
      const request: MCPRequest = {
        id: '2',
        method: 'tools/list',
      };

      const response = await mockServer.sendRequest(request);

      expect(response.result).toHaveProperty('tools');
      const tools = (response.result as any).tools;
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(7);
      
      const toolNames = tools.map((tool: any) => tool.name);
      expect(toolNames).toContain('pb_feature_create');
      expect(toolNames).toContain('pb_feature_list');
      expect(toolNames).toContain('pb_user_current');
    });

    it('should provide tool schemas', async () => {
      const response = await mockServer.sendRequest({
        id: '2',
        method: 'tools/list',
      });

      const tools = (response.result as any).tools;
      const createFeatureTool = tools.find((tool: any) => tool.name === 'pb_feature_create');
      
      expect(createFeatureTool).toBeDefined();
      expect(createFeatureTool.description).toBe('Create a new feature');
      expect(createFeatureTool.inputSchema).toMatchObject({
        type: 'object',
        required: ['name', 'description'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
        },
      });
    });
  });

  describe('Tool Execution', () => {
    beforeEach(async () => {
      await mockServer.sendRequest({
        id: '1',
        method: 'initialize',
        params: {},
      });
    });

    it('should execute pb_feature_create successfully', async () => {
      const request: MCPRequest = {
        id: '3',
        method: 'tools/call',
        params: {
          name: 'pb_feature_create',
          arguments: {
            name: 'Test Feature',
            description: 'A test feature for the mock server',
          },
        },
      };

      const response = await mockServer.sendRequest(request);

      expect(response.result).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: expect.stringMatching(/^feature-/),
          name: 'Test Feature',
          description: 'A test feature for the mock server',
          status: 'new',
        }),
      });
    });

    it('should execute pb_feature_list with pagination', async () => {
      const request: MCPRequest = {
        id: '4',
        method: 'tools/call',
        params: {
          name: 'pb_feature_list',
          arguments: {
            limit: 3,
            offset: 0,
          },
        },
      };

      const response = await mockServer.sendRequest(request);

      expect(response.result).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: expect.stringMatching(/^feature-/),
            name: expect.stringContaining('Mock Feature'),
          }),
        ]),
        pagination: {
          limit: 3,
          offset: 0,
          total: 50,
          hasMore: true,
        },
      });
    });

    it('should execute pb_user_current', async () => {
      const request: MCPRequest = {
        id: '5',
        method: 'tools/call',
        params: {
          name: 'pb_user_current',
          arguments: {},
        },
      };

      const response = await mockServer.sendRequest(request);

      expect(response.result).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: 'user-test-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'admin',
        }),
      });
    });

    it('should handle unknown tool calls', async () => {
      const request: MCPRequest = {
        id: '6',
        method: 'tools/call',
        params: {
          name: 'pb_unknown_tool',
          arguments: {},
        },
      };

      const response = await mockServer.sendRequest(request);

      expect(response.error).toMatchObject({
        code: -32603,
        message: 'Tool not found: pb_unknown_tool',
      });
    });
  });

  describe('Custom Tool Registration', () => {
    beforeEach(async () => {
      await mockServer.sendRequest({
        id: '1',
        method: 'initialize',
        params: {},
      });
    });

    it('should register and execute custom tools', async () => {
      const customTool = {
        name: 'pb_custom_test',
        description: 'A custom test tool',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
        },
        handler: async (params: any) => ({
          success: true,
          data: { output: `Processed: ${params.input}` },
        }),
      };

      mockServer.registerTool(customTool);

      // Verify tool is listed
      const listResponse = await mockServer.sendRequest({
        id: '2',
        method: 'tools/list',
      });

      const tools = (listResponse.result as any).tools;
      expect(tools.some((tool: any) => tool.name === 'pb_custom_test')).toBe(true);

      // Execute custom tool
      const execResponse = await mockServer.sendRequest({
        id: '3',
        method: 'tools/call',
        params: {
          name: 'pb_custom_test',
          arguments: { input: 'test data' },
        },
      });

      expect(execResponse.result).toMatchObject({
        success: true,
        data: { output: 'Processed: test data' },
      });
    });
  });

  describe('Error Simulation', () => {
    beforeEach(async () => {
      await mockServer.sendRequest({
        id: '1',
        method: 'initialize',
        params: {},
      });
    });

    it('should simulate tool execution errors', async () => {
      const testError = new Error('Simulated tool error');
      mockServer.simulateError('pb_feature_create', testError);

      const request: MCPRequest = {
        id: '7',
        method: 'tools/call',
        params: {
          name: 'pb_feature_create',
          arguments: {
            name: 'Test Feature',
            description: 'This will fail',
          },
        },
      };

      const response = await mockServer.sendRequest(request);

      expect(response.error).toMatchObject({
        code: -32603,
        message: 'Simulated tool error',
      });
    });
  });

  describe('Performance Testing Features', () => {
    beforeEach(async () => {
      await mockServer.sendRequest({
        id: '1',
        method: 'initialize',
        params: {},
      });
    });

    it('should add latency for performance testing', async () => {
      const delayMs = 100;
      mockServer.addLatency('pb_user_current', delayMs);

      const startTime = Date.now();
      await mockServer.sendRequest({
        id: '8',
        method: 'tools/call',
        params: {
          name: 'pb_user_current',
          arguments: {},
        },
      });
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(delayMs);
    });
  });

  describe('Server State Management', () => {
    it('should reset server state', async () => {
      // Initialize and connect
      await mockServer.sendRequest({
        id: '1',
        method: 'initialize',
        params: {},
      });
      expect(mockServer.isServerConnected()).toBe(true);

      // Reset server
      mockServer.reset();
      expect(mockServer.isServerConnected()).toBe(false);

      // Should require re-initialization
      const response = await mockServer.sendRequest({
        id: '2',
        method: 'tools/list',
      });
      expect(response.error?.message).toBe('Server not initialized');
    });

    it('should handle ping requests', async () => {
      await mockServer.sendRequest({
        id: '1',
        method: 'initialize',
        params: {},
      });

      const response = await mockServer.sendRequest({
        id: '2',
        method: 'ping',
      });

      expect(response.result).toEqual({ status: 'pong' });
    });

    it('should handle shutdown requests', async () => {
      await mockServer.sendRequest({
        id: '1',
        method: 'initialize',
        params: {},
      });

      const response = await mockServer.sendRequest({
        id: '2',
        method: 'shutdown',
      });

      expect(response.result).toEqual({ status: 'shutdown' });
      expect(mockServer.isServerConnected()).toBe(false);
    });
  });

  describe('Complex Workflow Testing', () => {
    beforeEach(async () => {
      await mockServer.sendRequest({
        id: '1',
        method: 'initialize',
        params: {},
      });
    });

    it('should support complete feature management workflow', async () => {
      // 1. Create feature
      const createResponse = await mockServer.sendRequest({
        id: '2',
        method: 'tools/call',
        params: {
          name: 'pb_feature_create',
          arguments: {
            name: 'Workflow Test Feature',
            description: 'Testing complete workflow',
          },
        },
      });

      expect(createResponse.result).toMatchObject({
        success: true,
        data: expect.objectContaining({
          name: 'Workflow Test Feature',
        }),
      });

      const featureId = (createResponse.result as any).data.id;

      // 2. Get feature details
      const getResponse = await mockServer.sendRequest({
        id: '3',
        method: 'tools/call',
        params: {
          name: 'pb_feature_get',
          arguments: { id: featureId },
        },
      });

      expect(getResponse.result).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: featureId,
        }),
      });

      // 3. Update feature
      const updateResponse = await mockServer.sendRequest({
        id: '4',
        method: 'tools/call',
        params: {
          name: 'pb_feature_update',
          arguments: {
            id: featureId,
            status: 'in_progress',
          },
        },
      });

      expect(updateResponse.result).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: featureId,
          status: 'in_progress',
        }),
      });

      // 4. List features
      const listResponse = await mockServer.sendRequest({
        id: '5',
        method: 'tools/call',
        params: {
          name: 'pb_feature_list',
          arguments: {},
        },
      });

      expect(listResponse.result).toMatchObject({
        success: true,
        data: expect.any(Array),
      });
    });
  });
});