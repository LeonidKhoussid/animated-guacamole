import { createAiRequest, streamAiResponse, getAiRequest, getChatHistory } from '../controllers/ai.controller.js';
import { getVariant } from '../controllers/variants.controller.js';
import { getPublicVariant } from '../controllers/variants.controller.js';

export default async function (fastify) {
  // Create AI request
  fastify.post('/ai/request', createAiRequest);

  // Get chat history for user
  fastify.get('/ai/history', getChatHistory);

  // Get AI request with variants
  fastify.get('/ai/requests/:id', getAiRequest);

  // WebSocket stream for AI responses
  fastify.get('/ai/stream/:request_id', { websocket: true }, streamAiResponse);

  // Get variant details
  fastify.get('/variants/:id', getVariant);

  // Public share endpoint
  fastify.get('/share/:variant_id', getPublicVariant);
}


