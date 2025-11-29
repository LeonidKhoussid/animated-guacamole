// Reusable schema definitions for Swagger/OpenAPI
export const schemas = {
  Error: {
    type: 'object',
    properties: {
      error: { type: 'string' },
    },
  },
  User: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      fullName: { type: 'string' },
      phone: { type: 'string' },
    },
  },
  Plan: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' },
      fileUrl: { type: 'string', format: 'uri' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  Variant: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      aiRequestId: { type: 'string', format: 'uuid' },
      description: { type: 'string' },
      normativeExplanation: { type: 'string' },
      approvalProbability: { type: 'number', minimum: 0, maximum: 1 },
      thumbnailUrl: { type: 'string', format: 'uri' },
      model3dUrl: { type: 'string', format: 'uri' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  Application: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' },
      variantId: { type: 'string', format: 'uuid' },
      status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
};

