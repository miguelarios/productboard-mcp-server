# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Start
- `npm run build` - Compile TypeScript to JavaScript and fix import paths
- `npm run dev` - Start development server with hot reload using tsx
- `npm start` - Run the compiled server from dist/

### Testing
- `npm test` - Run all tests with Jest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report (95% threshold required)
- Single test: `npm test -- tests/unit/path/to/specific.test.ts`

### Code Quality
- `npm run lint` - Run ESLint on TypeScript files
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run typecheck` - Type check without emitting files
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check formatting without modifying files

## Architecture Overview

This is a **Model Context Protocol (MCP) server** that provides comprehensive integration with the Productboard API through 49 specialized tools. The architecture follows a modular, permission-based design:

### Core Components

- **`src/core/server.ts`** - Main MCP server implementation using `@modelcontextprotocol/sdk`
- **`src/auth/manager.ts`** - Authentication manager supporting Bearer tokens and OAuth2
- **`src/auth/permission-discovery.ts`** - Dynamically discovers user permissions and registers tools accordingly
- **`src/tools/base.ts`** - Abstract base class for all tools with permission checking
- **`src/api/client.ts`** - Productboard API client with rate limiting and retry logic

### Tool Registration System

Tools are automatically discovered and registered based on user permissions:
1. Server imports all tools from `@tools/index.js`
2. Permission discovery service determines user's Productboard access level
3. Only tools matching user permissions are registered
4. Tools extend `BaseTool` and implement permission metadata

### Directory Structure

- `src/core/` - MCP server core functionality and protocol handling
- `src/auth/` - Authentication, permissions, and credential management
- `src/api/` - Productboard API client and error handling
- `src/tools/` - 49 MCP tools organized by category (features, products, notes, etc.)
- `src/middleware/` - Rate limiting, caching, and validation
- `src/utils/` - Configuration, logging, and error utilities

### Key Patterns

- **Permission-based tool access** - Tools define required permissions and access levels
- **Path aliases** - Use `@auth/`, `@api/`, `@core/`, `@tools/`, `@middleware/`, `@utils/` imports
- **ESM modules** - Full ES modules with `.js` extensions in imports
- **Comprehensive error handling** - Custom error types for different failure modes
- **Structured logging** - Uses Pino logger with configurable levels

### Testing Architecture

- **Unit tests** - `tests/unit/` with extensive mocking and 95% coverage requirement
- **Integration tests** - `tests/integration/` for tool registration and API interactions  
- **E2E tests** - `tests/e2e/` for full MCP protocol testing
- **Test utilities** - `tests/helpers/test-utils.ts` provides common mocking helpers

### Configuration

- Environment-based configuration via `.env` file
- JSON schema validation in `config/schema.json`
- Support for both Bearer token and OAuth2 authentication
- **OAuth2 scope configuration** via `PRODUCTBOARD_OAUTH_SCOPES` environment variable
- Configurable rate limiting, caching, and logging levels

## Important Implementation Notes

- All imports use `.js` extensions even for TypeScript files (ESM requirement)
- Tools are filtered by user permissions - some may not be available with limited access
- The server validates Productboard API connection and credentials on startup
- Rate limiting prevents API abuse with configurable per-tool limits
- Caching improves performance for read operations
- OAuth2 tokens are automatically refreshed when expired

## OAuth2 Scope Configuration

Tools are registered based on OAuth2 scopes requested during authorization:

- **Configure scopes** in `.env`: `PRODUCTBOARD_OAUTH_SCOPES=users:read product_hierarchy_data:read notes:create`
- **Run OAuth2 setup**: `npm run oauth2:setup` 
- **Server registers tools** matching available permissions
- **See oauth2-config.yml** for complete scope definitions and role descriptions

**Important**: Scopes must match between your Productboard OAuth2 application and your `.env` configuration.