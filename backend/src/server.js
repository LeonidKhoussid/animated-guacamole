import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import staticFiles from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { swaggerOptions, swaggerUiOptions } from './config/swagger.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastify = Fastify({
  logger: true,
});

// Register plugins
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://animated-guacamole-7ahp.onrender.com',
  'https://eloquent-sunflower-d11879.netlify.app',
];
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
fastify.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow non-browser or same-origin
    const isAllowed = [...defaultOrigins, ...allowedOrigins].includes(origin);
    cb(isAllowed ? null : new Error('Not allowed by CORS'), isAllowed);
  },
  credentials: true,
});

// Register Swagger (must be after CORS but before routes)
fastify.register(swagger, swaggerOptions);
fastify.register(swaggerUi, swaggerUiOptions);

fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
});

fastify.register(websocket);

// Serve static files (uploaded plans)
fastify.register(staticFiles, {
  root: join(__dirname, '../uploads'),
  prefix: '/uploads/',
});

// Register routes
import authRoutes from './routes/auth.routes.js';
import plansRoutes from './routes/plans.routes.js';
import aiRoutes from './routes/ai.routes.js';
import favoritesRoutes from './routes/favorites.routes.js';
import applicationsRoutes from './routes/applications.routes.js';
import adminRoutes from './routes/admin.routes.js';

fastify.register(authRoutes);
fastify.register(plansRoutes);
fastify.register(aiRoutes);
fastify.register(favoritesRoutes);
fastify.register(applicationsRoutes);
fastify.register(adminRoutes);

// Health check
fastify.get('/health', {
  schema: {
    tags: ['Health'],
    description: 'Health check endpoint',
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string' },
        },
      },
    },
  },
}, async (request, reply) => {
  return { status: 'ok' };
});

// Start server
const start = async () => {
  try {
    const port = process.env.PORT || 3001;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
