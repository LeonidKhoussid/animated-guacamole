import { addFavorite, removeFavorite, getFavorites } from '../controllers/favorites.controller.js';
import { schemas } from '../config/schemas.js';

export default async function (fastify) {
  fastify.post('/favorites', {
    schema: {
      tags: ['Favorites'],
      description: 'Add variant to favorites',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['variant_id'],
        properties: {
          variant_id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        201: {
          description: 'Variant added to favorites',
          type: 'object',
          properties: {
            message: { type: 'string' },
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
  }, addFavorite);

  fastify.get('/favorites', {
    schema: {
      tags: ['Favorites'],
      description: 'Get user favorites',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          description: 'Favorites retrieved successfully',
          type: 'array',
          items: {
            type: 'object',
            properties: schemas.Variant.properties,
          },
        },
      },
    },
  }, getFavorites);

  fastify.delete('/favorites/:variant_id', {
    schema: {
      tags: ['Favorites'],
      description: 'Remove variant from favorites',
      security: [{ bearerAuth: [] }],
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
          description: 'Variant removed from favorites',
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        404: {
          description: 'Favorite not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, removeFavorite);
}


