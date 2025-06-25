declare module '@modelcontextprotocol/sdk' {
  export interface ServerOptions {
    name: string;
    version: string;
  }

  export interface ServerCapabilities {
    capabilities: {
      tools?: {};
      resources?: {};
      prompts?: {};
    };
  }
}

declare module '@modelcontextprotocol/sdk/server/index.js' {
  export class Server {
    constructor(options: ServerOptions, capabilities: ServerCapabilities);
    connect(transport: Transport): Promise<void>;
    close(): Promise<void>;
    setRequestHandler(method: string, handler: RequestHandler): void;
  }

  export interface Transport {
    // Transport interface
  }

  export type RequestHandler = (request: Request) => Promise<unknown>;

  export interface Request {
    method: string;
    params?: unknown;
  }
}

declare module '@modelcontextprotocol/sdk/server/stdio.js' {
  export class StdioServerTransport {
    constructor();
  }
}