import { CurrentUserTool } from '@tools/users/current-user';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';

describe('CurrentUserTool', () => {
  let tool: CurrentUserTool;
  let mockApiClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockApiClient = {
      makeRequest: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    tool = new CurrentUserTool(mockApiClient, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(tool.name).toBe('pb_user_current');
      expect(tool.description).toBe('Get information about the authenticated user');
    });

    it('should define correct parameters schema', () => {
      expect(tool.parameters).toMatchObject({
        type: 'object',
        properties: {},
      });
    });
  });

  describe('execute', () => {
    const mockCurrentUser = {
      id: 'current-user',
      email: 'current@example.com',
      name: 'Current User',
      role: 'contributor',
      active: true,
      permissions: [
        'features.read',
        'features.write',
        'notes.read',
        'notes.write',
      ],
      workspace: {
        id: 'workspace-1',
        name: 'My Workspace',
        plan: 'pro',
      },
    };

    it('should get current user information successfully', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: mockCurrentUser,
        links: {},
      });

      const result = await tool.execute({});

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/users/me',
      });

      expect(result).toEqual({
        success: true,
        data: mockCurrentUser,
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Getting current user information');
    });

    it('should handle user with minimal information', async () => {
      const minimalUser = {
        id: 'user-minimal',
        email: 'minimal@example.com',
        role: 'viewer',
        active: true,
      };

      mockApiClient.makeRequest.mockResolvedValue({
        data: minimalUser,
        links: {},
      });

      const result = await tool.execute({});

      expect(result).toEqual({
        success: true,
        data: minimalUser,
      });
    });

    it('should handle authentication errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(
        new Error('Authentication token invalid')
      );

      await expect(tool.execute({})).rejects.toThrow('Authentication token invalid');
    });

    it('should handle expired token errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(
        new Error('Token expired')
      );

      await expect(tool.execute({})).rejects.toThrow('Token expired');
    });

    it('should handle network errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(
        new Error('Network error')
      );

      await expect(tool.execute({})).rejects.toThrow('Network error');
    });

    it('should accept empty parameters object', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: mockCurrentUser,
        links: {},
      });

      const result = await tool.execute({});

      expect((result as any).success).toBe(true);
    });

    it('should ignore any passed parameters', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: mockCurrentUser,
        links: {},
      });

      // Even if we pass parameters, they should be ignored
      const result = await tool.execute({ someParam: 'value' } as any);

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/users/me',
      });

      expect((result as any).success).toBe(true);
    });
  });
});