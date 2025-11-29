import { uploadPlan, getPlan, proxyImage } from '../controllers/plans.controller.js';

export default async function (fastify) {
  // Proxy endpoint for images (no auth required, but validates URL)
  fastify.get('/plans/proxy', {
    schema: {
      tags: ['Plans'],
      description: 'Proxy image from S3 with CORS headers',
      querystring: {
        type: 'object',
        required: ['url'],
        properties: {
          url: {
            type: 'string',
            format: 'uri',
            description: 'Image URL to proxy',
          },
        },
      },
    },
  }, proxyImage);

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


