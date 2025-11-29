import * as aiService from '../services/ai.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import prisma from '../models/prisma.js';

export const createAiRequest = async (request, reply) => {
  try {
    await authenticate(request, reply);
    const userId = request.user.userId;
    const { plan_id, text, audio_url, annotated_image_url, previous_request_id } = request.body;

    if (!plan_id) {
      return reply.code(400).send({ error: 'plan_id is required' });
    }

    const aiRequest = await aiService.createAiRequest(
      userId,
      plan_id,
      text,
      audio_url,
      annotated_image_url
    );

    // Store previous_request_id for context (we'll use it when streaming)
    // For now, we'll pass it through the request object or store it temporarily
    // Since we don't have a field in the schema, we'll find the most recent request for the plan
    let contextRequestId = previous_request_id;
    if (!contextRequestId) {
      // Find the most recent request for this plan by the same user
      const recentRequest = await prisma.aiRequest.findFirst({
        where: {
          userId,
          planId: plan_id,
          id: { not: aiRequest.id },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (recentRequest) {
        contextRequestId = recentRequest.id;
      }
    }

    return reply.code(201).send({
      request_id: aiRequest.id,
      previous_request_id: contextRequestId, // Return it so frontend can track context
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};

export const streamAiResponse = (connection, request) => {
  // In Fastify WebSocket, connection IS the WebSocket socket itself
  const socket = connection;
  
  if (!socket) {
    console.error('WebSocket socket not available');
    return;
  }
  
  // Check if socket has WebSocket methods
  if (typeof socket.on !== 'function') {
    console.error('Socket does not have .on() method');
    return;
  }

  // Set up event handlers
  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  socket.on('close', (code, reason) => {
    console.log(`WebSocket closed: ${code} - ${reason || 'No reason'}`);
  });

  // Process the request asynchronously
  (async () => {
    try {
      const { request_id } = request.params;
      
      // Verify token from query string
      const token = request.query?.token;
      if (!token) {
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({
            type: 'error',
            data: { message: 'Authentication required' },
          }));
          socket.close(1008, 'Unauthorized');
        }
        return;
      }

      // Verify JWT token
      let decoded;
      try {
        decoded = await request.server.jwt.verify(token);
      } catch (jwtError) {
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({
            type: 'error',
            data: { message: 'Invalid token' },
          }));
          socket.close(1008, 'Unauthorized');
        }
        return;
      }
      
      // Get AI request
      const aiRequest = await prisma.aiRequest.findUnique({
        where: { id: request_id },
      });

      if (!aiRequest) {
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({
            type: 'error',
            data: { message: 'Request not found' },
          }));
          socket.close(1008, 'Request not found');
        }
        return;
      }

      // Verify user owns the request
      if (aiRequest.userId !== decoded.userId) {
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({
            type: 'error',
            data: { message: 'Unauthorized access' },
          }));
          socket.close(1008, 'Unauthorized');
        }
        return;
      }

      // Find previous request for context (most recent request for this plan by same user)
      const previousRequest = await prisma.aiRequest.findFirst({
        where: {
          userId: decoded.userId,
          planId: aiRequest.planId,
          id: { not: request_id },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Stream variants with conversation context
      await aiService.streamVariants(
        request_id, 
        aiRequest.planId, 
        connection, 
        aiRequest.inputText,
        previousRequest?.id || null
      );
    } catch (error) {
      console.error('WebSocket initialization error:', error);
      if (socket && socket.readyState === 1) {
        socket.send(JSON.stringify({
          type: 'error',
          data: { message: 'Failed to initialize: ' + error.message },
        }));
        socket.close();
      }
    }
  })();
};

export const getAiRequest = async (request, reply) => {
  try {
    await authenticate(request, reply);
    const userId = request.user.userId;
    const { id } = request.params;

    const aiRequest = await aiService.getAiRequest(id, userId);
    return reply.send(aiRequest);
  } catch (error) {
    if (error.message === 'AI request not found' || error.message === 'Unauthorized access') {
      return reply.code(error.message === 'Unauthorized access' ? 403 : 404).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};

export const getChatHistory = async (request, reply) => {
  try {
    await authenticate(request, reply);
    const userId = request.user.userId;

    const chatHistory = await aiService.getUserChatHistory(userId);
    return reply.send(chatHistory);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};

