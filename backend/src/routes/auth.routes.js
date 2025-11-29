import { register, login, adminLogin } from '../controllers/auth.controller.js';

export default async function (fastify) {
  // User registration
  fastify.post('/auth/register', register);

  // User login
  fastify.post('/auth/login', login);

  // Admin login
  fastify.post('/admin/login', adminLogin);
}


