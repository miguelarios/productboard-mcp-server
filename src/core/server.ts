import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  ServerMetrics,
  HealthStatus,
} from './types.js';
import { MCPProtocolHandler } from './protocol.js';
import { ToolRegistry } from './registry.js';
import { AuthenticationManager } from '@auth/index.js';
import { AuthenticationType } from '@auth/types.js';
import { ProductboardAPIClient } from '@api/index.js';
import { RateLimiter, CacheModule } from '@middleware/index.js';
import { Config, Logger } from '@utils/index.js';
import { ServerError } from '@utils/errors.js';

export interface ServerDependencies {
  config: Config;
  logger: Logger;
  authManager: AuthenticationManager;
  apiClient: ProductboardAPIClient;
  toolRegistry: ToolRegistry;
  rateLimiter: RateLimiter;
  cache: CacheModule;
  protocolHandler: MCPProtocolHandler;
}

export class ProductboardMCPServer {
  private server?: Server;
  private transport?: StdioServerTransport;
  private dependencies: ServerDependencies;
  private startTime: Date;
  private metrics: ServerMetrics;

  constructor(dependencies: ServerDependencies) {
    this.dependencies = dependencies;
    this.startTime = new Date();
    this.metrics = {
      uptime: 0,
      requestsTotal: 0,
      requestsSuccess: 0,
      requestsFailed: 0,
      averageResponseTime: 0,
      activeConnections: 0,
    };
  }

  static async create(config: Config): Promise<ProductboardMCPServer> {
    const logger = new Logger({
      level: config.logLevel,
      pretty: config.logPretty,
    });

    const authConfig = {
      type: config.auth.type,
      credentials: {
        type: config.auth.type,
        token: config.auth.token,
        clientId: config.auth.clientId,
        clientSecret: config.auth.clientSecret,
      },
      baseUrl: config.api.baseUrl,
    };

    const authManager = new AuthenticationManager(authConfig, logger);

    // Set credentials from configuration
    if (config.auth.type === AuthenticationType.BEARER_TOKEN && config.auth.token) {
      authManager.setCredentials({
        type: AuthenticationType.BEARER_TOKEN,
        token: config.auth.token
      });
    } else if (config.auth.type === AuthenticationType.OAUTH2 && config.auth.clientId && config.auth.clientSecret) {
      authManager.setCredentials({
        type: AuthenticationType.OAUTH2,
        clientId: config.auth.clientId,
        clientSecret: config.auth.clientSecret,
      });
    }
    
    const rateLimiter = new RateLimiter(
      config.rateLimit.global,
      config.rateLimit.windowMs,
      config.rateLimit.perTool,
    );

    const apiClient = new ProductboardAPIClient(
      config.api,
      authManager,
      logger,
      rateLimiter,
    );

    const cache = new CacheModule(config.cache);
    const toolRegistry = new ToolRegistry(logger);
    const protocolHandler = new MCPProtocolHandler(toolRegistry, logger);

    const dependencies: ServerDependencies = {
      config,
      logger,
      authManager,
      apiClient,
      toolRegistry,
      rateLimiter,
      cache,
      protocolHandler,
    };

    return new ProductboardMCPServer(dependencies);
  }

  async initialize(): Promise<void> {
    const { logger, authManager, apiClient } = this.dependencies;

    try {
      logger.info('Initializing Productboard MCP Server...');

      // Validate configuration
      const configValidation = this.dependencies.config;
      logger.debug('Configuration loaded', { config: configValidation });

      // Validate authentication (skip in test mode)
      if (process.env.NODE_ENV === 'test') {
        logger.info('Skipping authentication validation in test mode');
      } else {
        logger.info('Validating authentication...');
        const isAuthenticated = await authManager.validateCredentials();
        if (!isAuthenticated) {
          throw new ServerError('Authentication validation failed');
        }
        logger.info('Authentication validated successfully');
      }

      // Test API connection (skip in test mode)
      if (process.env.NODE_ENV === 'test') {
        logger.info('Skipping API connection test in test mode');
      } else {
        logger.info('Testing API connection...');
        const connectionTest = await apiClient.testConnection();
        if (!connectionTest) {
          throw new ServerError('API connection test failed');
        }
        logger.info('API connection established');
      }

      // Register tools
      await this.registerTools();

      // Initialize MCP server
      this.initializeMCPServer();

      logger.info('Productboard MCP Server initialized successfully');
    } catch (error) {
      logger.fatal('Failed to initialize server', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    const { logger } = this.dependencies;

    if (!this.server || !this.transport) {
      throw new ServerError('Server not initialized');
    }

    try {
      logger.info('Starting Productboard MCP Server...');
      await this.server.connect(this.transport);
      logger.info('Productboard MCP Server started successfully');
    } catch (error) {
      logger.fatal('Failed to start server', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    const { logger } = this.dependencies;

    try {
      logger.info('Stopping Productboard MCP Server...');
      
      if (this.server) {
        await this.server.close();
      }

      logger.info('Productboard MCP Server stopped successfully');
    } catch (error) {
      logger.error('Error while stopping server', error);
      throw error;
    }
  }

  private initializeMCPServer(): void {
    const { logger, toolRegistry } = this.dependencies;

    this.server = new Server(
      {
        name: 'productboard-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.transport = new StdioServerTransport();

    // Set up request handlers
    // Note: Using type assertion due to TypeScript definition mismatch with actual implementation
    (this.server as any).setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: toolRegistry.listTools(),
      };
    });

    // Set up tool execution handler
    (this.server as any).setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const startTime = Date.now();
      this.metrics.requestsTotal++;
      this.metrics.activeConnections++;

      try {
        const { name, arguments: args } = request.params;

        const result = await this.handleToolExecution(name, args);

        this.metrics.requestsSuccess++;
        this.updateResponseTime(Date.now() - startTime);

        return result;
      } catch (error) {
        this.metrics.requestsFailed++;
        logger.error('Tool execution failed', error);
        throw error;
      } finally {
        this.metrics.activeConnections--;
      }
    });
  }

  private async handleToolExecution(toolName: string, params: unknown): Promise<unknown> {
    const { protocolHandler, cache, logger } = this.dependencies;

    // Check cache for read operations
    const cacheKey = cache.getCacheKey({ tool: toolName, method: toolName, params });
    const cachedResult = cache.get(cacheKey);
    if (cachedResult !== null) {
      logger.debug(`Cache hit for tool: ${toolName}`);
      return cachedResult;
    }

    // Execute tool
    const result = await protocolHandler.invokeTool(toolName, params);

    // Cache result if applicable
    if (cache.shouldCache({ tool: toolName, method: toolName, params })) {
      cache.set(cacheKey, result);
      logger.debug(`Cached result for tool: ${toolName}`);
    }

    return result;
  }

  private async registerTools(): Promise<void> {
    const { logger, toolRegistry, apiClient } = this.dependencies;
    logger.info('Registering Productboard tools...');

    try {
      // Import only essential tools first to isolate any hanging issues
      const {
        // User tools (simple, no complex dependencies)
        CurrentUserTool,

        // Feature tools (core functionality)
        CreateFeatureTool,
        ListFeaturesTool,
        GetFeatureTool,
      } = await import('@tools/index.js');

      logger.info('Tools imported successfully');

      // Register tools one by one with error handling
      try {
        logger.info('Registering CurrentUserTool...');
        toolRegistry.registerTool(new CurrentUserTool(apiClient, logger));
        logger.info('CurrentUserTool registered');

        logger.info('Registering CreateFeatureTool...');
        toolRegistry.registerTool(new CreateFeatureTool(apiClient, logger));
        logger.info('CreateFeatureTool registered');

        logger.info('Registering ListFeaturesTool...');
        toolRegistry.registerTool(new ListFeaturesTool(apiClient, logger));
        logger.info('ListFeaturesTool registered');

        logger.info('Registering GetFeatureTool...');
        toolRegistry.registerTool(new GetFeatureTool(apiClient, logger));
        logger.info('GetFeatureTool registered');

      } catch (error) {
        logger.error('Error during tool registration:', error);
        throw error;
      }

      logger.info(`Tool registration complete. Registered ${toolRegistry.size()} tools`);
    } catch (error) {
      logger.error('Failed to import or register tools:', error);
      throw error;
    }
  }

  private updateResponseTime(responseTime: number): void {
    const currentAverage = this.metrics.averageResponseTime;
    const totalRequests = this.metrics.requestsSuccess + this.metrics.requestsFailed;
    this.metrics.averageResponseTime =
      (currentAverage * (totalRequests - 1) + responseTime) / totalRequests;
  }

  getHealth(): HealthStatus {
    const uptime = Date.now() - this.startTime.getTime();
    
    return {
      status: 'healthy',
      version: '1.0.0',
      uptime,
      checks: {
        api: true,
        auth: !this.dependencies.authManager.isTokenExpired(),
        rateLimit: true,
      },
    };
  }

  getMetrics(): ServerMetrics {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }
}