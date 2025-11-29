import prisma from '../models/prisma.js';
import { encrypt } from '../utils/encryption.js';

export const createApplication = async (userId, variantId, address, passportData) => {
  // Verify variant exists
  const variant = await prisma.variant.findUnique({
    where: { id: variantId },
  });

  if (!variant) {
    throw new Error('Variant not found');
  }

  // Encrypt passport data
  const encryptedPassportData = encrypt(passportData);

  const application = await prisma.application.create({
    data: {
      userId,
      variantId,
      address,
      passportData: encryptedPassportData,
      status: 'NEW',
    },
    include: {
      variant: true,
      user: {
        select: {
          id: true,
          fullName: true,
          phone: true,
        },
      },
    },
  });

  return application;
};

export const getApplication = async (applicationId, userId) => {
  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      userId, // Ensure user owns the application
    },
    include: {
      variant: {
        include: {
          aiRequest: {
            include: {
              plan: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          fullName: true,
          phone: true,
        },
      },
    },
  });

  if (!application) {
    throw new Error('Application not found');
  }

  return application;
};

export const getAllApplications = async () => {
  const applications = await prisma.application.findMany({
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          phone: true,
        },
      },
      variant: {
        select: {
          id: true,
          description: true,
          approvalProbability: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return applications;
};

export const getApplicationForAdmin = async (applicationId) => {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          phone: true,
        },
      },
      variant: {
        include: {
          aiRequest: {
            include: {
              plan: true,
            },
          },
        },
      },
      feedback: {
        include: {
          admin: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!application) {
    throw new Error('Application not found');
  }

  return application;
};

export const updateApplicationStatus = async (applicationId, adminId, status, comment, aiMistake) => {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new Error('Application not found');
  }

  // Update application status
  const updatedApplication = await prisma.application.update({
    where: { id: applicationId },
    data: { status },
  });

  // Create feedback if comment or mistake is reported
  if (comment || aiMistake) {
    await prisma.engineerFeedback.create({
      data: {
        applicationId,
        adminId,
        comment: comment || null,
        aiMistakeType: aiMistake ? 'GENERAL' : null,
      },
    });
  }

  return updatedApplication;
};


