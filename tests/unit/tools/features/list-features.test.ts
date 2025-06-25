import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ListFeaturesTool } from '@tools/features/list-features';
import { ProductboardAPIClient } from '@api/client';
// Error types are checked by message rather than type
import { mockFeatureData } from '../../../fixtures/features';

describe('ListFeaturesTool', () => {
  let tool: ListFeaturesTool;
  let mockClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: any;

  beforeEach(() => {
    mockClient = {
      post: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
    } as unknown as jest.Mocked<ProductboardAPIClient>;
    
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;
    
    tool = new ListFeaturesTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_feature_list');
      expect(tool.description).toBe('List features with optional filtering and pagination');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['new', 'in_progress', 'validation', 'done', 'archived'],
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20,
          },
          offset: {
            type: 'integer',
            minimum: 0,
            default: 0,
          },
          sort: {
            type: 'string',
            enum: ['created_at', 'updated_at', 'name', 'priority'],
            default: 'created_at',
          },
          order: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'desc',
          },
        },
      });
    });
  });

  describe('parameter validation', () => {
    it('should accept empty parameters', () => {
      const validation = tool.validateParams({});
      expect(validation.valid).toBe(true);
    });

    it('should validate limit range', async () => {
      await expect(tool.execute({ limit: 0 })).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ limit: 101 })).rejects.toThrow('Invalid parameters');
    });

    it('should validate offset minimum', async () => {
      await expect(tool.execute({ offset: -1 })).rejects.toThrow('Invalid parameters');
    });

    it('should validate status enum', async () => {
      await expect(tool.execute({ status: 'invalid' } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate sort enum', async () => {
      await expect(tool.execute({ sort: 'invalid_field' } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate order enum', async () => {
      await expect(tool.execute({ order: 'invalid_order' } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate tags array', async () => {
      await expect(tool.execute({ tags: 'not-an-array' } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid filter combinations', () => {
      const validation = tool.validateParams({
        status: 'in_progress',
        product_id: 'prod_123',
        tags: ['tag1', 'tag2'],
        limit: 50,
        offset: 20,
        sort: 'priority',
        order: 'asc',
      });
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should list features with default parameters', async () => {
      mockClient.get.mockResolvedValueOnce(mockFeatureData.listFeaturesResponse);

      const result = await tool.execute({});

      expect(mockClient.get).toHaveBeenCalledWith('/features', {
        limit: 20,
        offset: 0,
        sort: 'created_at',
        order: 'desc',
      });
      expect(result).toEqual(mockFeatureData.listFeaturesResponse);
    });

    it('should apply filters correctly', async () => {
      const filters = {
        status: 'in_progress' as const,
        product_id: 'prod_789',
        owner_email: 'john.doe@example.com',
        tags: ['mobile', 'security'],
        search: 'authentication',
      };

      mockClient.get.mockResolvedValueOnce(mockFeatureData.listFeaturesResponse);

      await tool.execute(filters);

      expect(mockClient.get).toHaveBeenCalledWith('/features', {
          status: 'in_progress',
          product_id: 'prod_789',
          owner_email: 'john.doe@example.com',
          tags: 'mobile,security',
          search: 'authentication',
          limit: 20,
          offset: 0,
          sort: 'created_at',
          order: 'desc',
      });
    });

    it('should handle pagination parameters', async () => {
      const paginationParams = {
        limit: 50,
        offset: 100,
      };

      mockClient.get.mockResolvedValueOnce(mockFeatureData.listFeaturesResponse);

      await tool.execute(paginationParams);

      expect(mockClient.get).toHaveBeenCalledWith('/features', {
          limit: 50,
          offset: 100,
          sort: 'created_at',
          order: 'desc',
      });
    });

    it('should handle sorting parameters', async () => {
      const sortParams = {
        sort: 'priority' as const,
        order: 'asc' as const,
      };

      mockClient.get.mockResolvedValueOnce(mockFeatureData.listFeaturesResponse);

      await tool.execute(sortParams);

      expect(mockClient.get).toHaveBeenCalledWith('/features', {
          limit: 20,
          offset: 0,
          sort: 'priority',
          order: 'asc',
      });
    });

    it('should handle empty results', async () => {
      const emptyResponse = {
        data: [],
        pagination: {
          total: 0,
          offset: 0,
          limit: 20,
          has_more: false,
        },
      };

      mockClient.get.mockResolvedValueOnce(emptyResponse);

      const result = await tool.execute({});
      expect(result).toEqual(emptyResponse);
    });

    it('should handle API errors gracefully', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(tool.execute({})).rejects.toThrow('Tool pb_feature_list execution failed');
    });

    it('should handle rate limiting', async () => {
      const error = new Error('Rate limited');
      (error as any).response = {
        status: 429,
        data: mockFeatureData.apiErrors.rateLimited,
      };
      mockClient.get.mockRejectedValueOnce(error);

      await expect(tool.execute({})).rejects.toThrow('Tool pb_feature_list execution failed');
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new ListFeaturesTool(null as any, mockLogger);
      await expect(uninitializedTool.execute({}))
        .rejects.toThrow('Tool pb_feature_list execution failed');
    });
  });

  describe('response transformation', () => {
    it('should handle paginated responses correctly', async () => {
      const paginatedResponse = {
        items: [
          { id: 'feat_1', name: 'Feature 1' },
          { id: 'feat_2', name: 'Feature 2' },
        ],
        meta: {
          pagination: {
            total_count: 100,
            page: 1,
            per_page: 20,
            total_pages: 5,
          },
        },
      };

      mockClient.get.mockResolvedValueOnce(paginatedResponse);

      const result = await tool.execute({ limit: 20 }) as any;

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should preserve all feature properties in response', async () => {
      mockClient.get.mockResolvedValueOnce(mockFeatureData.listFeaturesResponse);

      const result = await tool.execute({}) as any;

      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('name');
      expect(result.data[0]).toHaveProperty('description');
      expect(result.data[0]).toHaveProperty('status');
      expect(result.data[0]).toHaveProperty('priority');
      expect(result.data[0]).toHaveProperty('created_at');
    });

    it('should handle raw array response', async () => {
      const arrayResponse = [
        { id: 'feat_1', name: 'Feature 1' },
        { id: 'feat_2', name: 'Feature 2' },
      ];

      mockClient.get.mockResolvedValueOnce(arrayResponse);

      const result = await tool.execute({}) as any;

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(result.data).toEqual(arrayResponse);
      expect(result.pagination.total).toBe(2);
    });

    it('should handle response with items property', async () => {
      const itemsResponse = {
        items: [
          { id: 'feat_1', name: 'Feature 1' },
          { id: 'feat_2', name: 'Feature 2' },
        ],
      };

      mockClient.get.mockResolvedValueOnce(itemsResponse);

      const result = await tool.execute({}) as any;

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(result.data).toEqual(itemsResponse.items);
      expect(result.pagination.total).toBe(0);
    });
  });
});