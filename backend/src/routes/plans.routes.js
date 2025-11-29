import { uploadPlan, getPlan } from '../controllers/plans.controller.js';

export default async function (fastify) {
  fastify.post('/plans/upload', uploadPlan);
  fastify.get('/plans/:id', getPlan);
}


