export const mockFeatureData = {
  validFeature: {
    id: 'feat_123456',
    name: 'User Authentication Feature',
    description: 'Implement OAuth2 authentication for mobile app',
    status: 'in_progress',
    product_id: 'prod_789',
    component_id: 'comp_456',
    owner_email: 'john.doe@example.com',
    tags: ['authentication', 'mobile', 'security'],
    priority: 'high',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-20T14:30:00Z',
  },

  createFeatureInput: {
    name: 'User Authentication Feature',
    description: 'Implement OAuth2 authentication for mobile app',
    status: 'new',
    product_id: 'prod_789',
    component_id: 'comp_456',
    owner_email: 'john.doe@example.com',
    tags: ['authentication', 'mobile', 'security'],
    priority: 'high',
  },

  updateFeatureInput: {
    id: 'feat_123456',
    name: 'Updated Authentication Feature',
    status: 'validation',
    priority: 'critical',
  },

  listFeaturesResponse: {
    data: [
      {
        id: 'feat_123456',
        name: 'User Authentication Feature',
        description: 'Implement OAuth2 authentication for mobile app',
        status: 'in_progress',
        product_id: 'prod_789',
        owner_email: 'john.doe@example.com',
        priority: 'high',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-20T14:30:00Z',
      },
      {
        id: 'feat_234567',
        name: 'Payment Integration',
        description: 'Integrate Stripe payment gateway',
        status: 'new',
        product_id: 'prod_789',
        owner_email: 'jane.smith@example.com',
        priority: 'medium',
        created_at: '2024-01-16T11:00:00Z',
        updated_at: '2024-01-16T11:00:00Z',
      },
    ],
    pagination: {
      total: 25,
      offset: 0,
      limit: 20,
      has_more: true,
    },
  },

  invalidInputs: {
    missingRequired: {
      description: 'Missing name field',
    },
    invalidEmail: {
      name: 'Test Feature',
      description: 'Test description',
      owner_email: 'invalid-email',
    },
    invalidStatus: {
      name: 'Test Feature',
      description: 'Test description',
      status: 'invalid_status',
    },
    nameTooLong: {
      name: 'A'.repeat(256),
      description: 'Name exceeds 255 character limit',
    },
  },

  apiErrors: {
    notFound: {
      error: true,
      code: 'NOT_FOUND',
      message: 'Feature not found',
      details: { feature_id: 'feat_nonexistent' },
    },
    validationError: {
      error: true,
      code: 'VALIDATION_ERROR',
      message: 'Invalid input parameters',
      details: {
        fields: {
          name: 'Name is required',
          owner_email: 'Invalid email format',
        },
      },
    },
    rateLimited: {
      error: true,
      code: 'RATE_LIMITED',
      message: 'Rate limit exceeded',
      details: {
        retry_after: 60,
      },
    },
    authFailed: {
      error: true,
      code: 'AUTH_FAILED',
      message: 'Authentication failed',
      details: {},
    },
  },
};

export const mockApiResponses = {
  createSuccess: {
    status: 201,
    data: mockFeatureData.validFeature,
  },
  updateSuccess: {
    status: 200,
    data: {
      ...mockFeatureData.validFeature,
      name: 'Updated Authentication Feature',
      status: 'validation',
      priority: 'critical',
      updated_at: new Date().toISOString(),
    },
  },
  deleteSuccess: {
    status: 204,
    data: null,
  },
  archiveSuccess: {
    status: 200,
    data: {
      ...mockFeatureData.validFeature,
      status: 'archived',
      archived_at: new Date().toISOString(),
    },
  },
};