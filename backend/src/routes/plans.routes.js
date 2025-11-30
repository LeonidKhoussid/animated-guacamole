import { uploadPlan, getPlan, getUserPlans, proxyAsset } from '../controllers/plans.controller.js';

export default async function (fastify) {
  // Proxy endpoint for assets (images/models) with CORS headers
  fastify.get('/plans/proxy', { schema: { hide: true } }, proxyAsset);

  fastify.post('/plans/upload', {
    schema: {
      tags: ['Plans'],
      description: 'Upload a floor plan image',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      // Note: No body schema - multipart/form-data is handled by @fastify/multipart
      // File is accessed via request.file() in the controller, not request.body
      response: {
        201: {
          description: 'Plan uploaded successfully',
          type: 'object',
          properties: {
            plan_id: { type: 'string', format: 'uuid' },
            file_url: { type: 'string', format: 'uri' },
          },
        },
        400: {
          description: 'Bad request',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, uploadPlan);

  fastify.get('/plans', {
    schema: {
      tags: ['Plans'],
      description: 'Get all plans for the authenticated user',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          description: 'Plans retrieved successfully',
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              userId: { type: 'string', format: 'uuid' },
              fileUrl: { type: 'string', format: 'uri' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, getUserPlans);

  fastify.get('/plans/:id', {
    schema: {
      tags: ['Plans'],
      description: 'Get plan by ID',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Plan ID',
          },
        },
      },
      response: {
        200: {
          description: 'Plan retrieved successfully',
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            fileUrl: { type: 'string', format: 'uri' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        404: {
          description: 'Plan not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, getPlan);
}
