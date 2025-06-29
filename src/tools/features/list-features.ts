import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface ListFeaturesParams {
  status?: 'new' | 'in_progress' | 'validation' | 'done' | 'archived';
  product_id?: string;
  component_id?: string;
  owner_email?: string;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
  sort?: 'created_at' | 'updated_at' | 'name' | 'priority';
  order?: 'asc' | 'desc';
}

export class ListFeaturesTool extends BaseTool<ListFeaturesParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_feature_list',
      'List features with optional filtering and pagination',
      {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['new', 'in_progress', 'validation', 'done', 'archived'],
            description: 'Filter by feature status',
          },
          product_id: {
            type: 'string',
            description: 'Filter by product ID',
          },
          component_id: {
            type: 'string',
            description: 'Filter by component ID',
          },
          owner_email: {
            type: 'string',
            description: 'Filter by owner email',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by tags (features must have all specified tags)',
          },
          search: {
            type: 'string',
            description: 'Search in feature names and descriptions',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20,
            description: 'Number of results per page',
          },
          offset: {
            type: 'integer',
            minimum: 0,
            default: 0,
            description: 'Number of results to skip',
          },
          sort: {
            type: 'string',
            enum: ['created_at', 'updated_at', 'name', 'priority'],
            default: 'created_at',
            description: 'Sort field',
          },
          order: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'desc',
            description: 'Sort order',
          },
        },
      },
      {
        requiredPermissions: [Permission.FEATURES_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access to features',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: ListFeaturesParams): Promise<unknown> {
    // Apply defaults and convert array types to strings for QueryParams
    const queryParams: Record<string, any> = {
      limit: params.limit || 20,
      offset: params.offset || 0,
      sort: params.sort || 'created_at',
      order: params.order || 'desc',
    };

    // Add other parameters, converting arrays to strings
    if (params.status) queryParams.status = params.status;
    if (params.product_id) queryParams.product_id = params.product_id;
    if (params.component_id) queryParams.component_id = params.component_id;
    if (params.owner_email) queryParams.owner_email = params.owner_email;
    if (params.search) queryParams.search = params.search;
    if (params.tags && params.tags.length > 0) {
      queryParams.tags = params.tags.join(',');
    }

    const response = await this.apiClient.get('/features', queryParams);
    
    // Ensure consistent response structure
    if (response && !(response as any).data && !(response as any).pagination) {
      // Transform if needed to match expected structure
      return {
        data: Array.isArray(response) ? response : (response as any).items || [],
        pagination: (response as any).meta?.pagination || {
          total: Array.isArray(response) ? response.length : 0,
          offset: queryParams.offset,
          limit: queryParams.limit,
          has_more: false,
        },
      };
    }
    
    return response;
  }
}