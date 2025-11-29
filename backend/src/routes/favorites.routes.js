import { addFavorite, removeFavorite, getFavorites } from '../controllers/favorites.controller.js';

export default async function (fastify) {
  fastify.post('/favorites', addFavorite);
  fastify.get('/favorites', getFavorites);
  fastify.delete('/favorites/:variant_id', removeFavorite);
}


