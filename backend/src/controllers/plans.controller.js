import * as plansService from '../services/plans.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import axios from 'axios';

export const uploadPlan = async (request, reply) => {
  try {
    await authenticate(request, reply);
    const userId = request.user.userId;

    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const plan = await plansService.uploadPlan(userId, data);
    return reply.code(201).send({
      plan_id: plan.id,
      file_url: plan.fileUrl,
    });
  } catch (error) {
    if (error.message.includes('Invalid file type')) {
      return reply.code(400).send({ error: error.message });
    }
    if (error.message.includes('User not found')) {
      return reply.code(401).send({ error: error.message });
    }
    if (error.code === 'P2003') {
      return reply.code(401).send({ error: 'User not found. Please log out and log in again.' });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};

// Proxy endpoint to serve assets (images/3D files) with CORS headers
export const proxyAsset = async (request, reply) => {
  try {
    const { url } = request.query;
    
    if (!url) {
      return reply.code(400).send({ error: 'URL parameter is required' });
    }

    // Validate that URL is from our S3 bucket
    const allowedDomains = [
      'storage.yandexcloud.net',
      'localhost',
      '127.0.0.1',
    ];
    
    const urlObj = new URL(url);
    if (!allowedDomains.some(domain => urlObj.hostname.includes(domain))) {
      return reply.code(403).send({ error: 'Invalid image URL' });
    }

    // Fetch asset from storage
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 20000,
    });

    // Set CORS headers
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET');
    reply.header('Content-Type', response.headers['content-type'] || 'application/octet-stream');
    reply.header('Cache-Control', 'public, max-age=31536000');

    return reply.send(Buffer.from(response.data));
  } catch (error) {
    request.log.error('Asset proxy error:', error);
    return reply.code(500).send({ error: 'Failed to load asset' });
  }
};

export const getPlan = async (request, reply) => {
  try {
    await authenticate(request, reply);
    const userId = request.user.userId;
    const { id } = request.params;

    const plan = await plansService.getPlan(id, userId);
    return reply.send(plan);
  } catch (error) {
    if (error.message === 'Plan not found') {
      return reply.code(404).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};

export const getUserPlans = async (request, reply) => {
  try {
    await authenticate(request, reply);
    const userId = request.user.userId;

    const plans = await plansService.getUserPlans(userId);
    return reply.send(plans);
  } catch (error) {
    if (error.message.includes('User not found')) {
      return reply.code(401).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};

