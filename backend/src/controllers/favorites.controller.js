import * as favoritesService from '../services/favorites.service.js';
import { authenticate } from '../middleware/auth.middleware.js';

export const addFavorite = async (request, reply) => {
  try {
    await authenticate(request, reply);
    
    // If authentication failed, authenticate will have sent the response
    if (!request.user) {
      return; // Response already sent by authenticate
    }
    
    const userId = request.user.userId;
    const { variant_id } = request.body;

    request.log.info('Add favorite request:', { userId, variant_id, body: request.body, bodyType: typeof request.body });

    if (!variant_id) {
      request.log.warn('Missing variant_id in request body');
      return reply.code(400).send({ error: 'variant_id is required', received: request.body });
    }

    if (typeof variant_id !== 'string' || variant_id.trim() === '') {
      request.log.warn('Invalid variant_id format:', { variant_id, type: typeof variant_id });
      return reply.code(400).send({ error: 'variant_id must be a non-empty string', received: variant_id });
    }

    const favorite = await favoritesService.addFavorite(userId, variant_id);
    return reply.code(201).send(favorite);
  } catch (error) {
    request.log.error('Add favorite error:', error);
    if (error.message === 'Unauthorized') {
      return; // Already handled by authenticate
    }
    if (error.message === 'Variant already in favorites' || error.message === 'Variant not found') {
      return reply.code(400).send({ error: error.message });
    }
    return reply.code(500).send({ error: 'Internal server error', details: error.message });
  }
};

export const removeFavorite = async (request, reply) => {
  try {
    await authenticate(request, reply);
    const userId = request.user.userId;
    const { variant_id } = request.params;

    const result = await favoritesService.removeFavorite(userId, variant_id);
    return reply.send(result);
  } catch (error) {
    if (error.message === 'Favorite not found') {
      return reply.code(404).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};

export const getFavorites = async (request, reply) => {
  try {
    await authenticate(request, reply);
    
    // If authentication failed, authenticate will have sent the response
    if (!request.user) {
      return; // Response already sent by authenticate
    }
    
    const userId = request.user.userId;

    const favorites = await favoritesService.getUserFavorites(userId);
    return reply.send(favorites);
  } catch (error) {
    request.log.error('Get favorites error:', error);
    request.log.error('Error stack:', error.stack);
    return reply.code(500).send({ error: 'Internal server error', details: error.message });
  }
};


