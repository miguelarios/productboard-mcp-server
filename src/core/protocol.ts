import {
  MCPRequest,
  MCPResponse,
  MCPError,
  ProtocolHandler,
  ValidationResult,
} from './types.js';
import { ToolRegistry } from './registry.js';
import { Validator } from '@middleware/validator.js';
import { ProtocolError, ToolExecutionError } from '@utils/errors.js';
import { Logger } from '@utils/logger.js';

export class MCPProtocolHandler implements ProtocolHandler {
  private toolRegistry: ToolRegistry;
  private validator: Validator;
  private logger: Logger;

  constructor(toolRegistry: ToolRegistry, logger: Logger) {
    this.toolRegistry = toolRegistry;
    this.validator = new Validator();
    this.logger = logger;
  }

  parseRequest(input: string): MCPRequest {
    try {
      const data = JSON.parse(input) as unknown;
      
      if (!this.isValidRequestStructure(data)) {
        throw new ProtocolError('Invalid request structure');
      }
      
      return data as MCPRequest;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ProtocolError('Invalid JSON');
      }
      throw error;
    }
  }

  formatResponse(response: MCPResponse): string {
    return JSON.stringify(response);
  }

  validateRequest(request: MCPRequest): ValidationResult {
    const errors: string[] = [];
    
    if (!request.id) {
      errors.push('Request id is required');
    }
    
    if (!request.method) {
      errors.push('Request method is required');
    } else if (request.method.startsWith('pb_')) {
      if (!this.toolRegistry.hasTool(request.method)) {
        errors.push(`Unknown tool: ${request.method}`);
      } else if (request.params) {
        const schema = this.toolRegistry.getToolSchema(request.method);
        const validationResult = this.validator.validateSchema(request.params, schema);
        if (!validationResult.valid) {
          errors.push(...validationResult.errors.map(e => e.message));
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async invokeTool(toolName: string, params: unknown): Promise<unknown> {
    const tool = this.toolRegistry.getTool(toolName);
    if (!tool) {
      throw new ProtocolError(`Tool not found: ${toolName}`);
    }
    
    try {
      this.logger.debug(`Invoking tool: ${toolName}`, { params });
      const result = await tool.execute(params);
      this.logger.debug(`Tool ${toolName} completed successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Tool ${toolName} execution failed`, error);
      throw new ToolExecutionError(
        `Failed to execute tool ${toolName}`,
        toolName,
        error instanceof Error ? error : undefined,
      );
    }
  }

  createSuccessResponse(id: string | number, result: unknown): MCPResponse {
    return {
      id,
      result,
    };
  }

  createErrorResponse(id: string | number, error: Error): MCPResponse {
    let mcpError: MCPError;
    
    if (error instanceof ProtocolError) {
      mcpError = {
        code: -32700,
        message: error.message,
        data: error.details,
      };
    } else if (error instanceof ToolExecutionError) {
      mcpError = {
        code: -32603,
        message: error.message,
        data: error.details,
      };
    } else {
      mcpError = {
        code: -32603,
        message: 'Internal error',
        data: { originalError: error.message },
      };
    }
    
    return {
      id,
      error: mcpError,
    };
  }

  private isValidRequestStructure(data: unknown): data is MCPRequest {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    
    const obj = data as Record<string, unknown>;
    return 'id' in obj && 'method' in obj && typeof obj.method === 'string';
  }

  getSupportedMethods(): string[] {
    const toolMethods = this.toolRegistry.getToolNames();
    const systemMethods = [
      'initialize',
      'tools/list',
      'ping',
      'shutdown',
    ];
    
    return [...systemMethods, ...toolMethods];
  }
}