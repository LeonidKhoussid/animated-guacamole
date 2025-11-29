import { verifyAdminToken } from '../utils/jwt.js';

export const authenticateAdmin = async (request, reply) => {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const decoded = verifyAdminToken(token);
    request.admin = decoded;
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
};


