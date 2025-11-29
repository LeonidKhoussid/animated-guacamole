import { createApplication, getApplication } from '../controllers/applications.controller.js';
import { schemas } from '../config/schemas.js';

export default async function (fastify) {
  fastify.post('/applications', {
    schema: {
      tags: ['Applications'],
      description: 'Submit application to BTI',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['variant_id'],
        properties: {
          variant_id: { type: 'string', format: 'uuid' },
          fullName: { type: 'string' },
          passportSeries: { type: 'string' },
          passportNumber: { type: 'string' },
          passportIssuedBy: { type: 'string' },
          passportIssueDate: { type: 'string', format: 'date' },
          address: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
      },
      response: {
        201: {
          description: 'Application submitted successfully',
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
  }, createApplication);

  fastify.get('/applications/:id', {
    schema: {
      tags: ['Applications'],
      description: 'Get application by ID',
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
          description: 'Application retrieved successfully',
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
  }, getApplication);
}


