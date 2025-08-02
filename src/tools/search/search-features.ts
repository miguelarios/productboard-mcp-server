import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface SearchFeaturesParams {
  query: string;
  filters?: {
    status?: string[];
    product_ids?: string[];
    owner_emails?: string[];
    tags?: string[];
    created_after?: string;
    created_before?: string;
    updated_after?: string;
    updated_before?: string;
  };
  sort?: 'relevance' | 'created_at' | 'updated_at' | 'votes' | 'comments';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export class SearchFeaturesTool extends BaseTool<SearchFeaturesParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_search_features',
      'Advanced search for features',
      {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'Search query text',
          },
          filters: {
            type: 'object',
            properties: {
              status: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by status',
              },
              product_ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by product IDs',
              },
              owner_emails: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by owner emails',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by tags',
              },
              created_after: {
                type: 'string',
                format: 'date',
                description: 'Filter features created after date',
              },
              created_before: {
                type: 'string',
                format: 'date',
                description: 'Filter features created before date',
              },
              updated_after: {
                type: 'string',
                format: 'date',
                description: 'Filter features updated after date',
              },
              updated_before: {
                type: 'string',
                format: 'date',
                description: 'Filter features updated before date',
              },
            },
          },
          sort: {
            type: 'string',
            enum: ['relevance', 'created_at', 'updated_at', 'votes', 'comments'],
            default: 'relevance',
            description: 'Sort results by',
          },
          order: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'desc',
            description: 'Sort order',
          },
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            default: 20,
            description: 'Maximum number of results',
          },
          offset: {
            type: 'number',
            minimum: 0,
            default: 0,
            description: 'Number of results to skip',
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

  private async fetchAllFeaturesRecursively(endpoint: string): Promise<any[]> {
    const allFeatures: any[] = [];
    let currentEndpoint: string | null = endpoint;
    let pageCount = 0;

    while (currentEndpoint) {
      pageCount++;
      this.logger.debug(`Fetching page ${pageCount} from: ${currentEndpoint}`);

      const response: {
        data: any[];
        links?: { next?: string };
      } = await this.apiClient.get(currentEndpoint);

      // Add current page data
      if (response.data) {
        allFeatures.push(...response.data);
        this.logger.debug(`Page ${pageCount}: ${response.data.length} features`);
      }

      // Check for next link
      const nextLink: string | undefined = response.links?.next;
      
      if (nextLink) {
        // Extract just the path and query from the full URL
        try {
          const url = new URL(nextLink);
          currentEndpoint = url.pathname + url.search;
        } catch (error) {
          // If it's already a relative path, use as-is
          currentEndpoint = nextLink;
          this.logger.debug(`Using relative path: ${currentEndpoint}`);
        }
      } else {
        currentEndpoint = null;
      }

      // Safety check to prevent infinite loops
      if (pageCount > 100) {
        this.logger.warn('Reached maximum page limit (100), stopping pagination');
        break;
      }
    }

    this.logger.info(`Completed pagination: ${pageCount} pages, ${allFeatures.length} total features`);
    return allFeatures;
  }

  protected async executeInternal(params: SearchFeaturesParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Searching features with client-side filtering', { query: params.query });

      // Fetch all features by recursively following links.next
      this.logger.debug('Fetching all features via links.next pagination...');
      const allFeatures = await this.fetchAllFeaturesRecursively('/features');
      this.logger.debug(`Fetched ${allFeatures.length} total features`);

      // Apply client-side filtering
      const query = params.query.toLowerCase();
      let filteredFeatures = allFeatures.filter((feature: any) => {
        // Text search in name and description
        const matchesQuery = 
          (feature.name?.toLowerCase().includes(query)) ||
          (feature.description?.toLowerCase().includes(query));

        if (!matchesQuery) return false;

        // Apply filters if provided
        if (params.filters) {
          // Status filter
          if (params.filters.status?.length) {
            const statusMatches = params.filters.status.some(status => 
              feature.status?.name?.toLowerCase() === status.toLowerCase()
            );
            if (!statusMatches) return false;
          }

          // Owner email filter
          if (params.filters.owner_emails?.length) {
            const ownerMatches = params.filters.owner_emails.some(email => 
              feature.owner?.email?.toLowerCase() === email.toLowerCase()
            );
            if (!ownerMatches) return false;
          }

          // Date filters
          if (params.filters.created_after) {
            const createdAt = new Date(feature.createdAt);
            const afterDate = new Date(params.filters.created_after);
            if (createdAt <= afterDate) return false;
          }

          if (params.filters.created_before) {
            const createdAt = new Date(feature.createdAt);
            const beforeDate = new Date(params.filters.created_before);
            if (createdAt >= beforeDate) return false;
          }

          if (params.filters.updated_after) {
            const updatedAt = new Date(feature.updatedAt);
            const afterDate = new Date(params.filters.updated_after);
            if (updatedAt <= afterDate) return false;
          }

          if (params.filters.updated_before) {
            const updatedAt = new Date(feature.updatedAt);
            const beforeDate = new Date(params.filters.updated_before);
            if (updatedAt >= beforeDate) return false;
          }

          // Product IDs filter (check parent component)
          if (params.filters.product_ids?.length) {
            const productMatches = params.filters.product_ids.some(id => 
              feature.parent?.component?.id === id
            );
            if (!productMatches) return false;
          }
        }

        return true;
      });

      // Sort results
      const sortField = params.sort || 'relevance';
      const sortOrder = params.order || 'desc';

      filteredFeatures.sort((a: any, b: any) => {
        let comparison = 0;
        
        switch (sortField) {
          case 'created_at':
            comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
          case 'updated_at':
            comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
            break;
          case 'relevance':
          default:
            // For relevance, prioritize name matches over description matches
            const aNameMatch = a.name?.toLowerCase().includes(query) ? 1 : 0;
            const bNameMatch = b.name?.toLowerCase().includes(query) ? 1 : 0;
            comparison = bNameMatch - aNameMatch;
            break;
        }

        return sortOrder === 'desc' ? -comparison : comparison;
      });

      // Apply pagination
      const limit = params.limit || 20;
      const offset = params.offset || 0;
      const paginatedResults = filteredFeatures.slice(offset, offset + limit);

      this.logger.info(`Feature search completed: ${filteredFeatures.length} matches, returning ${paginatedResults.length} results`);

      return {
        success: true,
        data: {
          features: paginatedResults,
          total: filteredFeatures.length,
          limit,
          offset,
          query: params.query,
          hasMore: offset + limit < filteredFeatures.length,
        },
      };
    } catch (error) {
      this.logger.error('Failed to search features', error);
      
      return {
        success: false,
        error: `Failed to search features: ${(error as Error).message}`,
      };
    }
  }
}