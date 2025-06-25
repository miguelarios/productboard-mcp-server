import { Schema } from '@middleware/validator.js';

export interface MCPRequest {
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  id: string | number;
  result?: unknown;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Schema;
  execute(params: unknown): Promise<unknown>;
}

export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: Schema;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ServerMetrics {
  uptime: number;
  requestsTotal: number;
  requestsSuccess: number;
  requestsFailed: number;
  averageResponseTime: number;
  activeConnections: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  checks: {
    api: boolean;
    auth: boolean;
    rateLimit: boolean;
  };
}

export interface ProtocolHandler {
  parseRequest(input: string): MCPRequest;
  formatResponse(response: MCPResponse): string;
  validateRequest(request: MCPRequest): ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}