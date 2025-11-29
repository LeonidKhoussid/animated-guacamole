import * as applicationsService from '../services/applications.service.js';
import { authenticate } from '../middleware/auth.middleware.js';

export const createApplication = async (request, reply) => {
  try {
    await authenticate(request, reply);
    const userId = request.user.userId;
    const { variant_id, address, passport_data } = request.body;

    if (!variant_id || !address || !passport_data) {
      return reply.code(400).send({ error: 'variant_id, address, and passport_data are required' });
    }

    const application = await applicationsService.createApplication(
      userId,
      variant_id,
      address,
      passport_data
    );

    return reply.code(201).send({
      application_id: application.id,
    });
  } catch (error) {
    if (error.message === 'Variant not found') {
      return reply.code(404).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};

export const getApplication = async (request, reply) => {
  try {
    await authenticate(request, reply);
    const userId = request.user.userId;
    const { id } = request.params;

    const application = await applicationsService.getApplication(id, userId);
    return reply.send(application);
  } catch (error) {
    if (error.message === 'Application not found') {
      return reply.code(404).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};


