import { createAiRequest, streamAiResponse, getAiRequest, getChatHistory } from '../controllers/ai.controller.js';
import { getVariant, getPublicVariant, get3DModelModifications } from '../controllers/variants.controller.js';
import { schemas } from '../config/schemas.js';

export default async function (fastify) {
  // Create AI request
  fastify.post('/ai/request', {
    schema: {
      tags: ['AI'],
      description: 'Create a new AI replanning request',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['plan_id'],
        properties: {
          plan_id: { type: 'string', format: 'uuid' },
          text: { type: 'string' },
          audio_url: { type: 'string', format: 'uri' },
          annotated_image_url: { type: 'string', format: 'uri' },
          previous_request_id: { 
            anyOf: [
              { type: 'string', format: 'uuid' },
              { type: 'null' }
            ]
          },
        },
      },
      response: {
        201: {
          description: 'AI request created successfully',
          type: 'object',
          properties: {
            request_id: { type: 'string', format: 'uuid' },
            previous_request_id: { type: 'string', format: 'uuid' },
          },
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
  }, createAiRequest);

  // Get chat history for user
  fastify.get('/ai/history', {
    schema: {
      tags: ['AI'],
      description: 'Get user chat history',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          description: 'Chat history retrieved successfully',
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              inputText: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              variants: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: schemas.Variant.properties,
                },
              },
            },
          },
        },
      },
    },
  }, getChatHistory);

  // Get AI request with variants
  fastify.get('/ai/requests/:id', {
    schema: {
      tags: ['AI'],
      description: 'Get AI request with variants',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'AI request ID',
          },
        },
      },
      response: {
        200: {
          description: 'AI request retrieved successfully',
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            inputText: { type: 'string' },
            variants: {
              type: 'array',
              items: {
                type: 'object',
                properties: schemas.Variant.properties,
              },
            },
          },
        },
        404: {
          description: 'Variant not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, getAiRequest);

  // WebSocket stream for AI responses
  fastify.get('/ai/stream/:request_id', { websocket: true }, streamAiResponse);

  // Get variant details
  fastify.get('/variants/:id', {
    schema: {
      tags: ['Variants'],
      description: 'Get variant details',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Variant ID',
          },
        },
      },
      response: {
        200: {
          description: 'Variant retrieved successfully',
          type: 'object',
          properties: schemas.Variant.properties,
        },
        404: {
          description: 'Variant not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, getVariant);

  // Public share endpoint
  fastify.get('/share/:variant_id', {
    schema: {
      tags: ['Variants'],
      description: 'Get public variant (no authentication required)',
      params: {
        type: 'object',
        properties: {
          variant_id: {
            type: 'string',
            format: 'uuid',
            description: 'Variant ID',
          },
        },
      },
      response: {
        200: {
          description: 'Variant retrieved successfully',
          type: 'object',
          properties: schemas.Variant.properties,
        },
        404: {
          description: 'Variant not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, getPublicVariant);

  // Get 3D model modifications for variant
  fastify.get('/variants/:id/3d-modifications', {
    schema: {
      tags: ['Variants'],
      description: 'Get 3D model modifications for variant',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Variant ID',
          },
        },
      },
      response: {
        200: {
          description: '3D model modifications retrieved successfully',
          type: 'object',
          properties: {
            modifications: {
              type: 'array',
              items: {
                type: 'object',
              },
            },
            instructions: { type: 'string' },
          },
        },
        404: {
          description: 'Variant not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, get3DModelModifications);
}


