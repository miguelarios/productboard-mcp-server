import { Tool } from '../core/types.js';
import { Schema, ValidationResult, Validator } from '../middleware/validator.js';
import { ProductboardAPIClient } from '../api/client.js';
import { ValidationError as MCPValidationError, ToolExecutionError } from '../utils/errors.js';
import { Logger } from '../utils/logger.js';

export abstract class BaseTool<TParams = unknown> implements Tool {
  public readonly name: string;
  public readonly description: string;
  public readonly parameters: Schema;
  
  protected validator: Validator;
  protected apiClient: ProductboardAPIClient;
  protected logger: Logger;

  constructor(
    name: string,
    description: string,
    parameters: Schema,
    apiClient: ProductboardAPIClient,
    logger: Logger
  ) {
    this.name = name;
    this.description = description;
    this.parameters = parameters;
    this.apiClient = apiClient;
    this.logger = logger;
    this.validator = new Validator();
  }

  async execute(params: TParams): Promise<unknown> {
    // Validate parameters
    const validation = this.validateParams(params);
    if (!validation.valid) {
      throw new MCPValidationError(
        `Invalid parameters for tool ${this.name}`,
        validation.errors,
      );
    }

    // Execute the tool-specific logic
    try {
      return await this.executeInternal(params);
    } catch (error) {
      if (error instanceof Error) {
        throw new ToolExecutionError(
          `Tool ${this.name} execution failed: ${error.message}`,
          this.name,
          error,
        );
      }
      throw error;
    }
  }

  protected abstract executeInternal(params: TParams): Promise<unknown>;

  protected async validate(params: TParams): Promise<void> {
    const validation = this.validateParams(params);
    if (!validation.valid) {
      throw new MCPValidationError(
        `Invalid parameters for tool ${this.name}`,
        validation.errors,
      );
    }
  }

  validateParams(params: unknown): ValidationResult {
    return this.validator.validateSchema(params || {}, this.parameters);
  }

  protected transformResponse(data: unknown): unknown {
    // Default implementation returns data as-is
    // Override in subclasses for custom transformations
    return data;
  }

  protected handleError(error: Error): never {
    throw new ToolExecutionError(
      `${this.name} failed: ${error.message}`,
      this.name,
      error,
    );
  }

  getMetadata(): { name: string; description: string; inputSchema: Schema } {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.parameters,
    };
  }
}