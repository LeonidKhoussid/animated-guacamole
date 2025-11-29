import { getApplications, getApplicationDetail, makeDecision } from '../controllers/admin.controller.js';
import { schemas } from '../config/schemas.js';

export default async function (fastify) {
  fastify.get('/admin/applications', {
    schema: {
      tags: ['Admin'],
      description: 'Get all applications (admin only)',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'approved', 'rejected'],
            description: 'Filter by status',
          },
        },
      },
      response: {
        200: {
          description: 'Applications retrieved successfully',
          type: 'array',
          items: {
            type: 'object',
            properties: schemas.Application.properties,
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
  }, getApplications);

  fastify.get('/admin/applications/:id', {
    schema: {
      tags: ['Admin'],
      description: 'Get application details (admin only)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Application ID',
          },
        },
      },
      response: {
        200: {
          description: 'Application details retrieved successfully',
          type: 'object',
          properties: schemas.Application.properties,
        },
        404: {
          description: 'Application not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, getApplicationDetail);

  fastify.post('/admin/applications/:id/decision', {
    schema: {
      tags: ['Admin'],
      description: 'Make decision on application (admin only)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Application ID',
          },
        },
      },
      body: {
        type: 'object',
        required: ['status', 'feedback'],
        properties: {
          status: {
            type: 'string',
            enum: ['approved', 'rejected'],
            description: 'Decision status',
          },
          feedback: {
            type: 'string',
            description: 'Feedback for AI fine-tuning',
          },
        },
      },
      response: {
        200: {
          description: 'Decision made successfully',
          type: 'object',
          properties: schemas.Application.properties,
        },
        400: {
          description: 'Bad request',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, makeDecision);
}


