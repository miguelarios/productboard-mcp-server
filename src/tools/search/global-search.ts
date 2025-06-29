import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/index.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';
interface GlobalSearchParams {
  query: string;
  types?: Array<'feature' | 'note' | 'product' | 'objective' | 'user'>;
  limit?: number;
}

export class GlobalSearchTool extends BaseTool<GlobalSearchParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_search',
      'Search across all Productboard entities',
      {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            minLength: 1,
            description: 'Search query',
          },
          types: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['feature', 'note', 'product', 'objective', 'user'],
            },
            description: 'Entity types to search (defaults to all)',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 50,
            default: 10,
            description: 'Maximum results per type',
          },
        },
      },
      {
        requiredPermissions: [Permission.SEARCH],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires search access',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: GlobalSearchParams): Promise<unknown> {
    try {
      this.logger.info('Performing global search', { query: params.query });

      const queryParams: Record<string, any> = {
        q: params.query,
        limit: params.limit || 10,
      };

      if (params.types && params.types.length > 0) {
        queryParams.types = params.types.join(',');
      }

      const response = await this.apiClient.makeRequest({
        method: 'GET',
        endpoint: '/search',
        params: queryParams,
      });

      return {
        success: true,
        data: (response as any).data,
      };
    } catch (error) {
      this.logger.error('Failed to perform global search', error);

      return {
        success: false,
        error: `Failed to perform search: ${(error as Error).message}`,
      };
    }
  }
}