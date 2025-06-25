import { ProductboardMCPServer } from '../../src/core/server.js';
import { ToolRegistry } from '../../src/core/registry.js';

import { ProductboardAPIClient } from '../../src/api/client.js';
import { AuthenticationManager } from '../../src/auth/manager.js';
import { Logger } from '../../src/utils/logger.js';
import { RateLimiter } from '../../src/middleware/rateLimiter.js';
import nock from 'nock';

describe('MCP Integration Tests', () => {
  let mcpServer: ProductboardMCPServer;
  let toolRegistry: ToolRegistry;
  let apiClient: ProductboardAPIClient;
  let authManager: AuthenticationManager;
  let logger: Logger;
  let rateLimiter: RateLimiter;

  const BASE_URL = 'https://api.productboard.com';

  beforeEach(() => {
    // Setup logger
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    } as any;

    // Setup auth manager
    authManager = {
      validateCredentials: jest.fn().mockResolvedValue(true),
      getAuthHeaders: jest.fn().mockReturnValue({ Authorization: 'Bearer test-token' }),
      isTokenExpired: jest.fn().mockReturnValue(false),
    } as any;

    // Setup rate limiter
    rateLimiter = {
      waitForSlot: jest.fn().mockResolvedValue(undefined),
      isLimited: jest.fn().mockReturnValue(false),
      getRemainingRequests: jest.fn().mockReturnValue({ minute: 60, hour: 3600, day: 86400 }),
    } as any;

    // Setup API client
    apiClient = new ProductboardAPIClient(
      {
        baseUrl: BASE_URL,
        timeout: 5000,
        retryAttempts: 1,
        retryDelay: 100,
      },
      authManager,
      logger,
      rateLimiter
    );

    // Setup tool registry
    toolRegistry = new ToolRegistry(logger);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('MCP Server Initialization and Tool Registration', () => {
    it('should initialize MCP server and register tools correctly', async () => {
      const mockServer = {
        setRequestHandler: jest.fn(),
        connect: jest.fn(),
        close: jest.fn(),
      };

      jest.spyOn(require('@modelcontextprotocol/sdk/server/index.js'), 'Server')
        .mockImplementation(() => mockServer);

      // Mock API connection test
      nock(BASE_URL)
        .get('/users/current')
        .reply(200, { id: 'user-1', email: 'test@example.com' });

      const dependencies = {
        config: {
          logLevel: 'info',
          logPretty: false,
          auth: { type: 'bearer', token: 'test-token' },
          api: { baseUrl: BASE_URL, timeout: 5000 },
          rateLimit: { global: 60, windowMs: 60000, perTool: {} },
          cache: { ttl: 300000, maxSize: 1000 },
        },
        logger,
        authManager,
        apiClient,
        toolRegistry,
        rateLimiter,
        cache: {
          get: jest.fn().mockReturnValue(null),
          set: jest.fn(),
          getCacheKey: jest.fn().mockReturnValue('cache-key'),
          shouldCache: jest.fn().mockReturnValue(true),
        },
        protocolHandler: {
          invokeTool: jest.fn(),
        },
      } as any;

      mcpServer = new ProductboardMCPServer(dependencies);

      // Mock tool imports
      dependencies.protocolHandler.invokeTool = jest.fn().mockResolvedValue({ success: true });

      await mcpServer.initialize();

      expect(logger.info).toHaveBeenCalledWith('Initializing Productboard MCP Server...');
      expect(authManager.validateCredentials).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Productboard MCP Server initialized successfully');
    });
  });

  describe('MCP Protocol Compliance', () => {
    beforeEach(async () => {
      // Mock API responses
      nock(BASE_URL)
        .get('/users/current')
        .reply(200, { id: 'user-1', email: 'test@example.com' });
    });

    it('should respond to tools/list request with registered tools', async () => {
      const mockServer = {
        setRequestHandler: jest.fn(),
        connect: jest.fn(),
        close: jest.fn(),
      };

      // Mock Server constructor
      jest.spyOn(require('@modelcontextprotocol/sdk/server/index.js'), 'Server')
        .mockImplementation(() => mockServer);

      const dependencies = {
        config: { auth: { type: 'bearer', token: 'test-token' } },
        logger,
        authManager,
        apiClient,
        toolRegistry,
        rateLimiter,
        cache: {
          get: jest.fn().mockReturnValue(null),
          set: jest.fn(),
          getCacheKey: jest.fn(),
          shouldCache: jest.fn().mockReturnValue(false),
        },
        protocolHandler: {
          invokeTool: jest.fn(),
        },
      } as any;

      mcpServer = new ProductboardMCPServer(dependencies);
      await mcpServer.initialize();

      // Get the tools/list handler
      const toolsListCall = mockServer.setRequestHandler.mock.calls.find(
        (call: any) => call[0] === 'tools/list'
      );
      expect(toolsListCall).toBeDefined();

      const toolsListHandler = toolsListCall[1];
      const response = await toolsListHandler();

      expect(response.tools).toHaveLength(16);
      expect(response.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'pb_feature_create' }),
          expect.objectContaining({ name: 'pb_feature_get' }),
          expect.objectContaining({ name: 'pb_feature_list' }),
          expect.objectContaining({ name: 'pb_product_list' }),
          expect.objectContaining({ name: 'pb_note_create' }),
          expect.objectContaining({ name: 'pb_user_current' }),
          expect.objectContaining({ name: 'pb_search' }),
        ])
      );
    });

    it('should handle tools/call request for valid tool', async () => {
      const mockServer = {
        setRequestHandler: jest.fn(),
        connect: jest.fn(),
        close: jest.fn(),
      };

      jest.spyOn(require('@modelcontextprotocol/sdk/server/index.js'), 'Server')
        .mockImplementation(() => mockServer);

      // Mock feature creation API
      nock(BASE_URL)
        .post('/features', {
          name: 'Test Feature',
          description: 'A test feature',
          status: 'new',
        })
        .reply(201, {
          id: 'feature-1',
          name: 'Test Feature',
          description: 'A test feature',
          status: 'new',
        });

      const dependencies = {
        config: { auth: { type: 'bearer', token: 'test-token' } },
        logger,
        authManager,
        apiClient,
        toolRegistry,
        rateLimiter,
        cache: {
          get: jest.fn().mockReturnValue(null),
          set: jest.fn(),
          getCacheKey: jest.fn(),
          shouldCache: jest.fn().mockReturnValue(false),
        },
        protocolHandler: {
          invokeTool: jest.fn().mockImplementation(async (toolName, params) => {
            const tool = toolRegistry.getTool(toolName);
            if (tool) {
              return await tool.execute(params);
            }
            throw new Error(`Tool not found: ${toolName}`);
          }),
        },
      } as any;

      mcpServer = new ProductboardMCPServer(dependencies);
      await mcpServer.initialize();

      // Get the tools/call handler
      const toolsCallCall = mockServer.setRequestHandler.mock.calls.find(
        (call: any) => call[0] === 'tools/call'
      );
      expect(toolsCallCall).toBeDefined();

      const toolsCallHandler = toolsCallCall[1];
      const request = {
        params: {
          name: 'pb_feature_create',
          arguments: {
            name: 'Test Feature',
            description: 'A test feature',
          },
        },
      };

      const response = await toolsCallHandler(request);

      expect(response).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: 'feature-1',
          name: 'Test Feature',
        }),
      });
    });

    it('should handle tools/call request errors properly', async () => {
      const mockServer = {
        setRequestHandler: jest.fn(),
        connect: jest.fn(),
        close: jest.fn(),
      };

      jest.spyOn(require('@modelcontextprotocol/sdk/server/index.js'), 'Server')
        .mockImplementation(() => mockServer);

      // Mock API error
      nock(BASE_URL)
        .post('/features')
        .reply(400, {
          message: 'Validation error',
          errors: [{ field: 'name', message: 'Name is required' }],
        });

      const dependencies = {
        config: { auth: { type: 'bearer', token: 'test-token' } },
        logger,
        authManager,
        apiClient,
        toolRegistry,
        rateLimiter,
        cache: {
          get: jest.fn().mockReturnValue(null),
          set: jest.fn(),
          getCacheKey: jest.fn(),
          shouldCache: jest.fn().mockReturnValue(false),
        },
        protocolHandler: {
          invokeTool: jest.fn().mockImplementation(async (toolName, params) => {
            const tool = toolRegistry.getTool(toolName);
            if (tool) {
              return await tool.execute(params);
            }
            throw new Error(`Tool not found: ${toolName}`);
          }),
        },
      } as any;

      mcpServer = new ProductboardMCPServer(dependencies);
      await mcpServer.initialize();

      const toolsCallHandler = mockServer.setRequestHandler.mock.calls.find(
        (call: any) => call[0] === 'tools/call'
      )[1];

      const request = {
        params: {
          name: 'pb_feature_create',
          arguments: {
            name: '',
            description: 'Invalid feature',
          },
        },
      };

      const response = await toolsCallHandler(request);
      expect(response).toMatchObject({
        success: false,
        error: expect.stringContaining('Failed to create feature'),
      });
    });
  });

  describe('Tool Execution Flow', () => {
    beforeEach(async () => {
      nock(BASE_URL)
        .get('/users/current')
        .reply(200, { id: 'user-1' });
    });

    it('should execute complete feature workflow through MCP', async () => {
      const featureData = {
        id: 'feature-1',
        name: 'Integration Test Feature',
        description: 'Created through MCP integration test',
        status: 'new',
      };

      // Mock API calls
      nock(BASE_URL)
        .post('/features')
        .reply(201, featureData);

      nock(BASE_URL)
        .get('/features/feature-1')
        .reply(200, featureData);

      nock(BASE_URL)
        .get('/features')
        .query(true)
        .reply(200, {
          data: [featureData],
          pagination: { hasMore: false },
        });

      const mockServer = {
        setRequestHandler: jest.fn(),
        connect: jest.fn(),
        close: jest.fn(),
      };

      jest.spyOn(require('@modelcontextprotocol/sdk/server/index.js'), 'Server')
        .mockImplementation(() => mockServer);

      const dependencies = {
        config: { auth: { type: 'bearer', token: 'test-token' } },
        logger,
        authManager,
        apiClient,
        toolRegistry,
        rateLimiter,
        cache: {
          get: jest.fn().mockReturnValue(null),
          set: jest.fn(),
          getCacheKey: jest.fn(),
          shouldCache: jest.fn().mockReturnValue(false),
        },
        protocolHandler: {
          invokeTool: jest.fn().mockImplementation(async (toolName, params) => {
            const tool = toolRegistry.getTool(toolName);
            if (tool) {
              return await tool.execute(params);
            }
            throw new Error(`Tool not found: ${toolName}`);
          }),
        },
      } as any;

      mcpServer = new ProductboardMCPServer(dependencies);
      await mcpServer.initialize();

      const toolsCallHandler = mockServer.setRequestHandler.mock.calls.find(
        (call: any) => call[0] === 'tools/call'
      )[1];

      // 1. Create feature
      const createRequest = {
        params: {
          name: 'pb_feature_create',
          arguments: {
            name: 'Integration Test Feature',
            description: 'Created through MCP integration test',
          },
        },
      };

      const createResponse = await toolsCallHandler(createRequest);
      expect(createResponse).toMatchObject({
        success: true,
        data: expect.objectContaining({ id: 'feature-1' }),
      });

      // 2. Get feature
      const getRequest = {
        params: {
          name: 'pb_feature_get',
          arguments: { id: 'feature-1' },
        },
      };

      const getResponse = await toolsCallHandler(getRequest);
      expect(getResponse).toMatchObject({
        success: true,
        data: expect.objectContaining({ id: 'feature-1' }),
      });

      // 3. List features
      const listRequest = {
        params: {
          name: 'pb_feature_list',
          arguments: {},
        },
      };

      const listResponse = await toolsCallHandler(listRequest);
      expect(listResponse).toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({ id: 'feature-1' }),
        ]),
      });
    });
  });

  describe('MCP Server Lifecycle', () => {
    it('should start and stop server correctly', async () => {
      const mockServer = {
        setRequestHandler: jest.fn(),
        connect: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
      };

      const mockTransport = {};

      jest.spyOn(require('@modelcontextprotocol/sdk/server/index.js'), 'Server')
        .mockImplementation(() => mockServer);
      jest.spyOn(require('@modelcontextprotocol/sdk/server/stdio.js'), 'StdioServerTransport')
        .mockImplementation(() => mockTransport);

      nock(BASE_URL)
        .get('/users/current')
        .reply(200, { id: 'user-1' });

      const dependencies = {
        config: { auth: { type: 'bearer', token: 'test-token' } },
        logger,
        authManager,
        apiClient,
        toolRegistry,
        rateLimiter,
        cache: {
          get: jest.fn().mockReturnValue(null),
          set: jest.fn(),
          getCacheKey: jest.fn(),
          shouldCache: jest.fn().mockReturnValue(false),
        },
        protocolHandler: {
          invokeTool: jest.fn(),
        },
      } as any;

      mcpServer = new ProductboardMCPServer(dependencies);

      // Initialize
      await mcpServer.initialize();
      expect(logger.info).toHaveBeenCalledWith('Productboard MCP Server initialized successfully');

      // Start
      await mcpServer.start();
      expect(mockServer.connect).toHaveBeenCalledWith(mockTransport);
      expect(logger.info).toHaveBeenCalledWith('Productboard MCP Server started successfully');

      // Stop
      await mcpServer.stop();
      expect(mockServer.close).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Productboard MCP Server stopped successfully');
    });
  });

  describe('Health and Metrics Integration', () => {
    it('should provide health status through MCP server', async () => {
      const mockServer = {
        setRequestHandler: jest.fn(),
        connect: jest.fn(),
        close: jest.fn(),
      };

      jest.spyOn(require('@modelcontextprotocol/sdk/server/index.js'), 'Server')
        .mockImplementation(() => mockServer);

      nock(BASE_URL)
        .get('/users/current')
        .reply(200, { id: 'user-1' });

      const dependencies = {
        config: { auth: { type: 'bearer', token: 'test-token' } },
        logger,
        authManager,
        apiClient,
        toolRegistry,
        rateLimiter,
        cache: {
          get: jest.fn().mockReturnValue(null),
          set: jest.fn(),
          getCacheKey: jest.fn(),
          shouldCache: jest.fn().mockReturnValue(false),
        },
        protocolHandler: {
          invokeTool: jest.fn(),
        },
      } as any;

      mcpServer = new ProductboardMCPServer(dependencies);
      await mcpServer.initialize();

      const health = mcpServer.getHealth();

      expect(health).toMatchObject({
        status: 'healthy',
        version: '1.0.0',
        uptime: expect.any(Number),
        checks: {
          api: true,
          auth: true,
          rateLimit: true,
        },
      });
    });

    it('should track metrics during tool execution', async () => {

      nock(BASE_URL)
        .get('/users/current')
        .reply(200, { id: 'user-1' });

      nock(BASE_URL)
        .get('/features/feature-1')
        .reply(200, { id: 'feature-1', name: 'Test Feature' });

      const mockServer = {
        setRequestHandler: jest.fn(),
        connect: jest.fn(),
        close: jest.fn(),
      };

      jest.spyOn(require('@modelcontextprotocol/sdk/server/index.js'), 'Server')
        .mockImplementation(() => mockServer);

      const dependencies = {
        config: { auth: { type: 'bearer', token: 'test-token' } },
        logger,
        authManager,
        apiClient,
        toolRegistry,
        rateLimiter,
        cache: {
          get: jest.fn().mockReturnValue(null),
          set: jest.fn(),
          getCacheKey: jest.fn(),
          shouldCache: jest.fn().mockReturnValue(false),
        },
        protocolHandler: {
          invokeTool: jest.fn().mockImplementation(async (toolName, params) => {
            const tool = toolRegistry.getTool(toolName);
            if (tool) {
              return await tool.execute(params);
            }
            throw new Error(`Tool not found: ${toolName}`);
          }),
        },
      } as any;

      mcpServer = new ProductboardMCPServer(dependencies);
      await mcpServer.initialize();

      const toolsCallHandler = mockServer.setRequestHandler.mock.calls.find(
        (call: any) => call[0] === 'tools/call'
      )[1];

      // Execute a tool call
      await toolsCallHandler({
        params: {
          name: 'pb_feature_get',
          arguments: { id: 'feature-1' },
        },
      });

      const metrics = mcpServer.getMetrics();

      expect(metrics.requestsTotal).toBe(1);
      expect(metrics.requestsSuccess).toBe(1);
      expect(metrics.requestsFailed).toBe(0);
      expect(metrics.averageResponseTime).toBeGreaterThanOrEqual(0);
    });
  });
});