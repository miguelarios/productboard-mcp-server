import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/index.js';
import { Logger } from '@utils/logger.js';

interface CurrentUserParams {}

export class CurrentUserTool extends BaseTool<CurrentUserParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_user_current',
      'Get information about the authenticated user',
      {
        type: 'object',
        properties: {},
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(_params: CurrentUserParams): Promise<unknown> {
    this.logger.info('Getting current user information');

    const response = await this.apiClient.makeRequest({
      method: 'GET',
      endpoint: '/users/me',
    });

    return {
      success: true,
      data: (response as any).data,
    };
  }
}