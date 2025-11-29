import { register, login, adminLogin } from '../controllers/auth.controller.js';

export default async function (fastify) {
  // User registration
  fastify.post('/auth/register', {
    schema: {
      tags: ['Authentication'],
      description: 'Register a new user',
      body: {
        type: 'object',
        required: ['full_name', 'phone'],
        properties: {
          full_name: { type: 'string' },
          phone: { type: 'string' },
          password: { type: 'string', minLength: 6 },
        },
      },
      response: {
        201: {
          description: 'User registered successfully',
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                fullName: { type: 'string' },
                phone: { type: 'string' },
              },
            },
            token: { type: 'string' },
          },
        },
        400: {
          description: 'Bad request',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        409: {
          description: 'User already exists',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, register);

  // User login
  fastify.post('/auth/login', {
    schema: {
      tags: ['Authentication'],
      description: 'User login',
      body: {
        type: 'object',
        required: ['phone'],
        properties: {
          phone: { type: 'string' },
          password: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'Login successful',
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                fullName: { type: 'string' },
                phone: { type: 'string' },
              },
            },
            token: { type: 'string' },
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
          description: 'Invalid credentials',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, login);

  // Admin login
  fastify.post('/admin/login', {
    schema: {
      tags: ['Authentication'],
      description: 'Admin login',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'Login successful',
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
              },
            },
            token: { type: 'string' },
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
          description: 'Invalid credentials',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, adminLogin);
}


