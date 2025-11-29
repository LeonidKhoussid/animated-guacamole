import { createApplication, getApplication } from '../controllers/applications.controller.js';

export default async function (fastify) {
  fastify.post('/applications', createApplication);
  fastify.get('/applications/:id', getApplication);
}


