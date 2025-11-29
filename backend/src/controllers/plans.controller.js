import * as plansService from '../services/plans.service.js';
import { authenticate } from '../middleware/auth.middleware.js';

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
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
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


