import * as applicationsService from '../services/applications.service.js';
import { authenticateAdmin } from '../middleware/admin.middleware.js';

export const getApplications = async (request, reply) => {
  try {
    await authenticateAdmin(request, reply);
    const applications = await applicationsService.getAllApplications();
    return reply.send(applications);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};

export const getApplicationDetail = async (request, reply) => {
  try {
    await authenticateAdmin(request, reply);
    const { id } = request.params;
    const application = await applicationsService.getApplicationForAdmin(id);
    return reply.send(application);
  } catch (error) {
    if (error.message === 'Application not found') {
      return reply.code(404).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};

export const makeDecision = async (request, reply) => {
  try {
    await authenticateAdmin(request, reply);
    const adminId = request.admin.adminId;
    const { id } = request.params;
    const { status, engineer_comment, ai_mistake } = request.body;

    if (!status || !['APPROVED', 'REJECTED', 'NEEDS_FIX'].includes(status)) {
      return reply.code(400).send({ error: 'Invalid status. Must be APPROVED, REJECTED, or NEEDS_FIX' });
    }

    const application = await applicationsService.updateApplicationStatus(
      id,
      adminId,
      status,
      engineer_comment,
      ai_mistake
    );

    return reply.send({
      application_id: application.id,
      status: application.status,
      message: 'Decision recorded successfully',
    });
  } catch (error) {
    if (error.message === 'Application not found') {
      return reply.code(404).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};


