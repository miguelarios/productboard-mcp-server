import { ToolRegistry } from '../../src/core/registry.js';
import { ProductboardAPIClient } from '../../src/api/client.js';
import { AuthenticationManager } from '../../src/auth/manager.js';
import { Logger } from '../../src/utils/logger.js';
import { RateLimiter } from '../../src/middleware/rateLimiter.js';

// Import all necessary tools
import { CreateFeatureTool } from '../../src/tools/features/create-feature.js';
import { GetFeatureTool } from '../../src/tools/features/get-feature.js';
import { ListFeaturesTool } from '../../src/tools/features/list-features.js';
import { UpdateFeatureTool } from '../../src/tools/features/update-feature.js';
import { DeleteFeatureTool } from '../../src/tools/features/delete-feature.js';

import { CreateProductTool } from '../../src/tools/products/create-product.js';
import { ListProductsTool } from '../../src/tools/products/list-products.js';
import { ProductHierarchyTool } from '../../src/tools/products/product-hierarchy.js';

import { CreateNoteTool } from '../../src/tools/notes/create-note.js';
import { ListNotesTool } from '../../src/tools/notes/list-notes.js';
import { AttachNoteTool } from '../../src/tools/notes/attach-note.js';

import { CurrentUserTool } from '../../src/tools/users/current-user.js';
import { ListUsersTool } from '../../src/tools/users/list-users.js';
import { ListCompaniesTool } from '../../src/tools/companies/list-companies.js';
import { GlobalSearchTool } from '../../src/tools/search/global-search.js';
import { BulkUpdateFeaturesTool } from '../../src/tools/bulk/bulk-update-features.js';

import nock from 'nock';

describe('End-to-End Workflow Tests', () => {
  let registry: ToolRegistry;
  let apiClient: ProductboardAPIClient;
  let authManager: AuthenticationManager;
  let logger: Logger;
  let rateLimiter: RateLimiter;

  const BASE_URL = 'https://api.productboard.com';

  beforeEach(() => {
    // Setup dependencies
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    authManager = {
      getAuthHeaders: jest.fn().mockReturnValue({ Authorization: 'Bearer test-token' }),
      refreshTokenIfNeeded: jest.fn(),
      isAuthenticated: jest.fn().mockReturnValue(true),
    } as any;

    rateLimiter = {
      waitForSlot: jest.fn().mockResolvedValue(undefined),
      isLimited: jest.fn().mockReturnValue(false),
      getRemainingRequests: jest.fn().mockReturnValue({ minute: 60, hour: 3600, day: 86400 }),
    } as any;

    apiClient = new ProductboardAPIClient(
      {
        baseUrl: BASE_URL,
        timeout: 5000,
        retryAttempts: 1,
        retryDelay: 100,
      },
      authManager,
      logger,
      rateLimiter
    );

    registry = new ToolRegistry(logger);

    // Register all tools
    const tools = [
      new CreateFeatureTool(apiClient, logger),
      new GetFeatureTool(apiClient, logger),
      new ListFeaturesTool(apiClient, logger),
      new UpdateFeatureTool(apiClient, logger),
      new DeleteFeatureTool(apiClient, logger),
      new CreateProductTool(apiClient, logger),
      new ListProductsTool(apiClient, logger),
      new ProductHierarchyTool(apiClient, logger),
      new CreateNoteTool(apiClient, logger),
      new ListNotesTool(apiClient, logger),
      new AttachNoteTool(apiClient, logger),
      new CurrentUserTool(apiClient, logger),
      new ListUsersTool(apiClient, logger),
      new ListCompaniesTool(apiClient, logger),
      new GlobalSearchTool(apiClient, logger),
      new BulkUpdateFeaturesTool(apiClient, logger),
    ];

    tools.forEach(tool => registry.registerTool(tool));
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Feature Request Management Workflow', () => {
    it('should handle complete feature request lifecycle from customer feedback to release', async () => {
      // Mock data for the workflow
      const userData = { id: 'user-1', email: 'pm@company.com', role: 'admin' };
      const companyData = { id: 'company-1', name: 'Customer Corp', size: 'enterprise' };
      const productData = { id: 'product-1', name: 'Main Product', description: 'Our core product' };
      const noteData = { id: 'note-1', content: 'Customer wants better search functionality', customer_email: 'customer@customercorp.com' };
      const featureData = { id: 'feature-1', name: 'Enhanced Search', description: 'Improve search with filters and sorting', status: 'new' };

      // Setup API mocks for the entire workflow
      setupWorkflowMocks({
        userData,
        companyData,
        productData,
        noteData,
        featureData,
      });

      // Step 1: Product Manager checks current user and available resources
      const currentUser = await executeToolStep('pb_user_current', {});
      expect(currentUser).toMatchObject({
        success: true,
        data: expect.objectContaining({ id: 'user-1', role: 'admin' }),
      });

      const companies = await executeToolStep('pb_company_list', { size: 'enterprise' });
      expect(companies).toMatchObject({
        success: true,
        data: expect.objectContaining({
          companies: expect.arrayContaining([
            expect.objectContaining({ name: 'Customer Corp' }),
          ]),
        }),
      });

      const products = await executeToolStep('pb_product_list', {});
      expect(products).toMatchObject({
        success: true,
        data: expect.objectContaining({
          products: expect.arrayContaining([
            expect.objectContaining({ name: 'Main Product' }),
          ]),
        }),
      });

      // Step 2: Create customer feedback note
      const createdNote = await executeToolStep('pb_note_create', {
        content: 'Customer wants better search functionality',
        customer_email: 'customer@customercorp.com',
      });
      expect(createdNote).toMatchObject({
        success: true,
        data: expect.objectContaining({ id: 'note-1' }),
      });

      // Step 3: Create feature based on feedback
      const createdFeature = await executeToolStep('pb_feature_create', {
        name: 'Enhanced Search',
        description: 'Improve search with filters and sorting',
        status: 'new',
        product_id: 'product-1',
      });
      expect(createdFeature).toMatchObject({
        success: true,
        data: expect.objectContaining({ id: 'feature-1' }),
      });

      // Step 4: Attach customer note to feature
      const attachedNote = await executeToolStep('pb_note_attach', {
        note_id: 'note-1',
        feature_id: 'feature-1',
      });
      expect(attachedNote).toMatchObject({ success: true });

      // Step 5: Move feature through development stages
      const stages = ['in_progress', 'validation', 'done'] as const;
      
      for (const stage of stages) {
        const updatedFeature = await executeToolStep('pb_feature_update', {
          id: 'feature-1',
          status: stage,
        });
        expect(updatedFeature).toMatchObject({
          success: true,
          data: expect.objectContaining({ status: stage }),
        });
      }

      // Step 6: Verify feature completion and notes
      const finalFeature = await executeToolStep('pb_feature_get', {
        id: 'feature-1',
        include: ['notes'],
      });
      expect(finalFeature).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: 'feature-1',
          status: 'done',
        }),
      });

      const featureNotes = await executeToolStep('pb_note_list', {
        feature_id: 'feature-1',
      });
      expect(featureNotes).toMatchObject({
        data: expect.objectContaining({
          notes: expect.arrayContaining([
            expect.objectContaining({ id: 'note-1' }),
          ]),
        }),
      });

      // Step 7: Search for completed features
      const searchResults = await executeToolStep('pb_search', {
        query: 'Enhanced Search',
        types: ['feature'],
      });
      expect(searchResults).toMatchObject({
        success: true,
        data: expect.objectContaining({
          features: expect.arrayContaining([
            expect.objectContaining({ name: 'Enhanced Search' }),
          ]),
        }),
      });
    });

    // Helper function to execute tool steps
    async function executeToolStep(toolName: string, params: any) {
      const tool = registry.getTool(toolName);
      if (!tool) {
        throw new Error(`Tool ${toolName} not found`);
      }
      return await tool.execute(params);
    }

    // Helper function to setup all API mocks for the workflow
    function setupWorkflowMocks({ userData, companyData, productData, noteData, featureData }: any) {
      // Current user
      nock(BASE_URL).get('/users/me').reply(200, userData);

      // Companies list
      nock(BASE_URL)
        .get('/companies')
        .query({ size: 'enterprise' })
        .reply(200, { data: [companyData], total: 1 });

      // Products list
      nock(BASE_URL)
        .get('/products')
        .query(true)
        .reply(200, { data: [productData], total: 1 });

      // Note creation
      nock(BASE_URL)
        .post('/notes', {
          content: 'Customer wants better search functionality',
          customer_email: 'customer@customercorp.com',
        })
        .reply(201, noteData);

      // Feature creation
      nock(BASE_URL)
        .post('/features', {
          name: 'Enhanced Search',
          description: 'Improve search with filters and sorting',
          status: 'new',
          product_id: 'product-1',
        })
        .reply(201, featureData);

      // Note attachment
      nock(BASE_URL)
        .post('/notes/note-1/attach', { feature_id: 'feature-1' })
        .reply(200, { success: true });

      // Feature updates for each stage
      const stages = ['in_progress', 'validation', 'done'];
      stages.forEach(stage => {
        nock(BASE_URL)
          .patch('/features/feature-1', { status: stage })
          .reply(200, { ...featureData, status: stage });
      });

      // Feature retrieval with notes
      nock(BASE_URL)
        .get('/features/feature-1')
        .query({ include: 'notes' })
        .reply(200, { ...featureData, status: 'done', notes: [noteData] });

      // Notes list for feature
      nock(BASE_URL)
        .get('/notes')
        .query({ feature_id: 'feature-1' })
        .reply(200, { data: [noteData], pagination: { hasMore: false } });

      // Global search
      nock(BASE_URL)
        .get('/search')
        .query({ query: 'Enhanced Search', types: 'feature' })
        .reply(200, { features: [{ ...featureData, status: 'done' }] });
    }
  });

  describe('Product Portfolio Management Workflow', () => {
    it('should handle product hierarchy creation and feature organization', async () => {
      // Mock data for product portfolio
      const parentProduct = { id: 'product-parent', name: 'Platform Suite' };
      const childProducts = [
        { id: 'product-web', name: 'Web Application', parent_id: 'product-parent' },
        { id: 'product-mobile', name: 'Mobile App', parent_id: 'product-parent' },
        { id: 'product-api', name: 'API Gateway', parent_id: 'product-parent' },
      ];
      const features = [
        { id: 'feature-web-1', name: 'Web Dashboard', product_id: 'product-web' },
        { id: 'feature-mobile-1', name: 'Mobile UI', product_id: 'product-mobile' },
        { id: 'feature-api-1', name: 'Rate Limiting', product_id: 'product-api' },
      ];

      // Setup mocks for product portfolio workflow
      setupProductPortfolioMocks({ parentProduct, childProducts, features });

      // Step 1: Create parent product
      const createdParent = await executeToolStep('pb_product_create', {
        name: 'Platform Suite',
        description: 'Complete product platform',
      });
      expect(createdParent).toMatchObject({
        success: true,
        data: expect.objectContaining({ name: 'Platform Suite' }),
      });

      // Step 2: Create child products
      for (const childProduct of childProducts) {
        const created = await executeToolStep('pb_product_create', {
          name: childProduct.name,
          parent_id: 'product-parent',
          description: `${childProduct.name} component`,
        });
        expect(created).toMatchObject({
          success: true,
          data: expect.objectContaining({ name: childProduct.name }),
        });
      }

      // Step 3: Create features for each product
      for (const feature of features) {
        const created = await executeToolStep('pb_feature_create', {
          name: feature.name,
          description: `Feature for ${feature.name}`,
          product_id: feature.product_id,
        });
        expect(created).toMatchObject({
          success: true,
          data: expect.objectContaining({ name: feature.name }),
        });
      }

      // Step 4: Get complete product hierarchy
      const hierarchy = await executeToolStep('pb_product_hierarchy', {
        depth: 3,
        include_features: true,
      });
      expect(hierarchy).toMatchObject({
        success: true,
        data: expect.objectContaining({
          products: expect.arrayContaining([
            expect.objectContaining({
              name: 'Platform Suite',
              children: expect.arrayContaining([
                expect.objectContaining({ name: 'Web Application' }),
                expect.objectContaining({ name: 'Mobile App' }),
                expect.objectContaining({ name: 'API Gateway' }),
              ]),
            }),
          ]),
        }),
      });

      // Step 5: List features by product
      for (const childProduct of childProducts) {
        const productFeatures = await executeToolStep('pb_feature_list', {
          product_id: childProduct.id,
        });
        expect(productFeatures).toMatchObject({
          data: expect.arrayContaining([
            expect.objectContaining({
              product_id: childProduct.id,
            }),
          ]),
        });
      }

      // Step 6: Bulk update features to in_progress
      const featureIds = features.map(f => f.id);
      const bulkUpdate = await executeToolStep('pb_feature_bulk_update', {
        feature_ids: featureIds,
        updates: { status: 'in_progress' },
      });
      expect(bulkUpdate).toMatchObject({
        success: true,
        data: expect.objectContaining({
          updated: featureIds.length,
          failed: 0,
        }),
      });
    });

    async function executeToolStep(toolName: string, params: any) {
      const tool = registry.getTool(toolName);
      if (!tool) {
        throw new Error(`Tool ${toolName} not found`);
      }
      return await tool.execute(params);
    }

    function setupProductPortfolioMocks({ parentProduct, childProducts, features }: any) {
      // Parent product creation
      nock(BASE_URL)
        .post('/products', {
          name: 'Platform Suite',
          description: 'Complete product platform',
        })
        .reply(201, parentProduct);

      // Child products creation
      childProducts.forEach((child: any) => {
        nock(BASE_URL)
          .post('/products', {
            name: child.name,
            parent_id: 'product-parent',
            description: `${child.name} component`,
          })
          .reply(201, child);
      });

      // Features creation
      features.forEach((feature: any) => {
        nock(BASE_URL)
          .post('/features', {
            name: feature.name,
            description: `Feature for ${feature.name}`,
            product_id: feature.product_id,
          })
          .reply(201, feature);
      });

      // Product hierarchy
      nock(BASE_URL)
        .get('/products/hierarchy')
        .query({ depth: 3, include_features: true })
        .reply(200, {
          products: [{
            ...parentProduct,
            children: childProducts.map((child: any) => ({
              ...child,
              features: features.filter((f: any) => f.product_id === child.id),
            })),
          }],
        });

      // Features list by product
      childProducts.forEach((child: any) => {
        nock(BASE_URL)
          .get('/features')
          .query(obj => obj.product_id === child.id)
          .reply(200, {
            data: features.filter((f: any) => f.product_id === child.id),
            pagination: { hasMore: false }
          });
      });

      // Bulk update features
      nock(BASE_URL)
        .patch('/features/bulk', {
          feature_ids: features.map((f: any) => f.id),
          updates: { status: 'in_progress' },
        })
        .reply(200, {
          updated: features.length,
          failed: 0,
          results: features.map((f: any) => ({ id: f.id, success: true })),
        });
    }
  });

  describe('Customer Feedback Processing Workflow', () => {
    it('should handle end-to-end customer feedback processing and prioritization', async () => {
      const customerFeedback = [
        { id: 'note-1', content: 'Need better mobile experience', customer_email: 'customer1@enterprise.com' },
        { id: 'note-2', content: 'API rate limits too restrictive', customer_email: 'customer2@startup.com' },
        { id: 'note-3', content: 'Dashboard needs real-time updates', customer_email: 'customer3@enterprise.com' },
      ];

      const features = [
        { id: 'feature-mobile', name: 'Mobile Experience Enhancement', priority: 'high' },
        { id: 'feature-api', name: 'API Rate Limit Optimization', priority: 'medium' },
        { id: 'feature-dashboard', name: 'Real-time Dashboard', priority: 'high' },
      ];

      // Setup mocks for feedback processing workflow
      setupFeedbackProcessingMocks({ customerFeedback, features });

      // Step 1: Create customer feedback notes
      for (const feedback of customerFeedback) {
        const created = await executeToolStep('pb_note_create', {
          content: feedback.content,
          customer_email: feedback.customer_email,
        });
        expect(created).toMatchObject({
          success: true,
          data: expect.objectContaining({ id: feedback.id }),
        });
      }

      // Step 2: Analyze customer companies
      const companies = await executeToolStep('pb_company_list', {});
      expect(companies).toMatchObject({
        success: true,
        data: expect.objectContaining({
          companies: expect.arrayContaining([
            expect.objectContaining({ size: 'enterprise' }),
          ]),
        }),
      });

      // Step 3: Create features based on feedback
      for (const feature of features) {
        const created = await executeToolStep('pb_feature_create', {
          name: feature.name,
          description: `Feature addressing customer feedback`,
          priority: feature.priority,
        });
        expect(created).toMatchObject({
          success: true,
          data: expect.objectContaining({ name: feature.name }),
        });
      }

      // Step 4: Attach feedback to relevant features
      const attachments = [
        { note_id: 'note-1', feature_id: 'feature-mobile' },
        { note_id: 'note-2', feature_id: 'feature-api' },
        { note_id: 'note-3', feature_id: 'feature-dashboard' },
      ];

      for (const attachment of attachments) {
        const attached = await executeToolStep('pb_note_attach', attachment);
        expect(attached).toMatchObject({ success: true });
      }

      // Step 5: Prioritize high-priority features from enterprise customers
      const highPriorityFeatures = await executeToolStep('pb_feature_list', {
        priority: 'high',
      });
      expect(highPriorityFeatures).toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({ priority: 'high' }),
        ]),
      });

      // Step 6: Update high-priority features to in_progress
      const highPriorityIds = ['feature-mobile', 'feature-dashboard'];
      const bulkUpdate = await executeToolStep('pb_feature_bulk_update', {
        feature_ids: highPriorityIds,
        updates: { status: 'in_progress' },
      });
      expect(bulkUpdate).toMatchObject({
        success: true,
        data: expect.objectContaining({
          updated: 2,
          failed: 0,
        }),
      });

      // Step 7: Search for features with customer feedback
      const searchResults = await executeToolStep('pb_search', {
        query: 'mobile experience',
        types: ['feature', 'note'],
      });
      expect(searchResults).toMatchObject({
        success: true,
        data: expect.objectContaining({
          features: expect.arrayContaining([
            expect.objectContaining({ name: 'Mobile Experience Enhancement' }),
          ]),
          notes: expect.arrayContaining([
            expect.objectContaining({ content: 'Need better mobile experience' }),
          ]),
        }),
      });
    });

    async function executeToolStep(toolName: string, params: any) {
      const tool = registry.getTool(toolName);
      if (!tool) {
        throw new Error(`Tool ${toolName} not found`);
      }
      return await tool.execute(params);
    }

    function setupFeedbackProcessingMocks({ customerFeedback, features }: any) {
      // Notes creation
      customerFeedback.forEach((feedback: any) => {
        nock(BASE_URL)
          .post('/notes', {
            content: feedback.content,
            customer_email: feedback.customer_email,
          })
          .reply(201, feedback);
      });

      // Companies list
      nock(BASE_URL)
        .get('/companies')
        .query(true)
        .reply(200, {
          data: [
            { id: 'company-1', name: 'Enterprise Corp', size: 'enterprise' },
            { id: 'company-2', name: 'Startup Inc', size: 'small' },
          ],
          total: 2
        });

      // Features creation
      features.forEach((feature: any) => {
        nock(BASE_URL)
          .post('/features', {
            name: feature.name,
            description: 'Feature addressing customer feedback',
            priority: feature.priority,
          })
          .reply(201, feature);
      });

      // Note attachments
      const attachments = [
        { note_id: 'note-1', feature_id: 'feature-mobile' },
        { note_id: 'note-2', feature_id: 'feature-api' },
        { note_id: 'note-3', feature_id: 'feature-dashboard' },
      ];

      attachments.forEach((attachment: any) => {
        nock(BASE_URL)
          .post(`/notes/${attachment.note_id}/attach`, { feature_id: attachment.feature_id })
          .reply(200, { success: true });
      });

      // High priority features list
      nock(BASE_URL)
        .get('/features')
        .query(obj => obj.priority === 'high')
        .reply(200, {
          data: features.filter((f: any) => f.priority === 'high'),
          pagination: { hasMore: false }
        });

      // Bulk update high priority features
      nock(BASE_URL)
        .patch('/features/bulk', {
          feature_ids: ['feature-mobile', 'feature-dashboard'],
          updates: { status: 'in_progress' },
        })
        .reply(200, {
          updated: 2,
          failed: 0,
          results: [
            { id: 'feature-mobile', success: true },
            { id: 'feature-dashboard', success: true },
          ],
        });

      // Global search
      nock(BASE_URL)
        .get('/search')
        .query({ query: 'mobile experience', types: 'feature,note' })
        .reply(200, {
          features: [features.find((f: any) => f.id === 'feature-mobile')],
          notes: [customerFeedback.find((n: any) => n.id === 'note-1')],
        });
    }
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle partial failures in complex workflows gracefully', async () => {
      // Setup mocks for error scenarios
      nock(BASE_URL)
        .post('/features')
        .reply(201, { id: 'feature-1', name: 'Success Feature' });

      nock(BASE_URL)
        .post('/features')
        .reply(400, { message: 'Validation error', errors: [{ field: 'name', message: 'Required' }] });

      nock(BASE_URL)
        .post('/features')
        .reply(500, { message: 'Internal server error' });

      // Test successful operation
      const successResult = await executeToolStep('pb_feature_create', {
        name: 'Success Feature',
        description: 'This should succeed',
      });
      expect(successResult).toMatchObject({
        success: true,
        data: expect.objectContaining({ name: 'Success Feature' }),
      });

      // Test validation error
      await expect(executeToolStep('pb_feature_create', {
        name: 'Invalid Feature',
        description: 'This should fail validation',
      })).rejects.toThrow('Validation error');

      // Test server error with retry
      await expect(executeToolStep('pb_feature_create', {
        name: 'Server Error Feature',
        description: 'This should fail with server error',
      })).rejects.toThrow('Internal server error');
    });

    async function executeToolStep(toolName: string, params: any) {
      const tool = registry.getTool(toolName);
      if (!tool) {
        throw new Error(`Tool ${toolName} not found`);
      }
      return await tool.execute(params);
    }
  });
});