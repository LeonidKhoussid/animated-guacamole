import * as favoritesService from '../services/favorites.service.js';
import { authenticate } from '../middleware/auth.middleware.js';

export const addFavorite = async (request, reply) => {
  try {
    await authenticate(request, reply);
    const userId = request.user.userId;
    const { variant_id } = request.body;

    if (!variant_id) {
      return reply.code(400).send({ error: 'variant_id is required' });
    }

    const favorite = await favoritesService.addFavorite(userId, variant_id);
    return reply.code(201).send(favorite);
  } catch (error) {
    if (error.message === 'Variant already in favorites' || error.message === 'Variant not found') {
      return reply.code(400).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
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
    const userId = request.user.userId;

    const favorites = await favoritesService.getUserFavorites(userId);
    return reply.send(favorites);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};


