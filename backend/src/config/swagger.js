export const swaggerOptions = {
  openapi: {
    openapi: '3.0.0',
    info: {
      title: 'PlanAI - Apartment Replanning API',
      description: 'API for AI-assisted apartment replanning application',
      version: '1.0.0',
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
    ],
    tags: [
      { name: 'Authentication', description: 'User and admin authentication endpoints' },
      { name: 'Plans', description: 'Floor plan upload and management' },
      { name: 'AI', description: 'AI-powered replanning generation' },
      { name: 'Variants', description: 'Replanning variant management' },
      { name: 'Favorites', description: 'Favorite variants management' },
      { name: 'Applications', description: 'BTI application submission' },
      { name: 'Admin', description: 'Admin panel endpoints' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
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
        RegisterRequest: {
          type: 'object',
          required: ['full_name', 'phone'],
          properties: {
            full_name: { type: 'string' },
            phone: { type: 'string' },
            password: { type: 'string', minLength: 6 },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['phone'],
          properties: {
            phone: { type: 'string' },
            password: { type: 'string' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            user: { $ref: '#/components/schemas/User' },
            token: { type: 'string' },
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
        CreateAiRequest: {
          type: 'object',
          required: ['plan_id'],
          properties: {
            plan_id: { type: 'string', format: 'uuid' },
            text: { type: 'string' },
            audio_url: { type: 'string', format: 'uri' },
            annotated_image_url: { type: 'string', format: 'uri' },
            previous_request_id: { type: 'string', format: 'uuid' },
          },
        },
        AiRequestResponse: {
          type: 'object',
          properties: {
            request_id: { type: 'string', format: 'uuid' },
            previous_request_id: { type: 'string', format: 'uuid' },
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
        FavoriteRequest: {
          type: 'object',
          required: ['variant_id'],
          properties: {
            variant_id: { type: 'string', format: 'uuid' },
          },
        },
        ApplicationRequest: {
          type: 'object',
          required: ['variant_id'],
          properties: {
            variant_id: { type: 'string', format: 'uuid' },
            fullName: { type: 'string' },
            passportSeries: { type: 'string' },
            passportNumber: { type: 'string' },
            passportIssuedBy: { type: 'string' },
            passportIssueDate: { type: 'string', format: 'date' },
            address: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string', format: 'email' },
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
        AdminLoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
      },
    },
  },
};

export const swaggerUiOptions = {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false,
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
  transformSpecification: (swaggerObject, request, reply) => {
    return swaggerObject;
  },
  transformSpecificationClone: true,
};

