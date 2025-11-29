import prisma from '../models/prisma.js';

export const getVariant = async (variantId) => {
  const variant = await prisma.variant.findUnique({
    where: { id: variantId },
    include: {
      aiRequest: {
        include: {
          plan: true,
        },
      },
    },
  });

  if (!variant) {
    throw new Error('Variant not found');
  }

  return variant;
};

export const getPublicVariant = async (variantId) => {
  const variant = await getVariant(variantId);
  // Return variant without sensitive user data
  return variant;
};


