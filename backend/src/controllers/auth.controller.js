import * as authService from '../services/auth.service.js';

export const register = async (request, reply) => {
  try {
    const { full_name, phone, password } = request.body;

    if (!full_name || !phone) {
      return reply.code(400).send({ error: 'Full name and phone are required' });
    }

    const result = await authService.registerUser(full_name, phone, password);
    return reply.code(201).send(result);
  } catch (error) {
    if (error.message === 'User with this phone number already exists') {
      return reply.code(409).send({ error: error.message });
    }
    request.log.error('Registration error:', error);
    return reply.code(500).send({ error: error.message || 'Internal server error' });
  }
};

export const login = async (request, reply) => {
  try {
    const { phone, password } = request.body;

    if (!phone) {
      return reply.code(400).send({ error: 'Phone is required' });
    }

    const result = await authService.loginUser(phone, password);
    return reply.send(result);
  } catch (error) {
    if (error.message.includes('Invalid')) {
      return reply.code(401).send({ error: error.message });
    }
    request.log.error('Login error:', error);
    return reply.code(500).send({ error: error.message || 'Internal server error' });
  }
};

export const adminLogin = async (request, reply) => {
  try {
    const { email, password } = request.body;

    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required' });
    }

    const result = await authService.loginAdmin(email, password);
    return reply.send(result);
  } catch (error) {
    if (error.message.includes('Invalid')) {
      return reply.code(401).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};


