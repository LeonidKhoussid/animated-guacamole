import { getApplications, getApplicationDetail, makeDecision } from '../controllers/admin.controller.js';

export default async function (fastify) {
  fastify.get('/admin/applications', getApplications);
  fastify.get('/admin/applications/:id', getApplicationDetail);
  fastify.post('/admin/applications/:id/decision', makeDecision);
}


