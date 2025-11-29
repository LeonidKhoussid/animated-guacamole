import prisma from '../models/prisma.js';

export const addFavorite = async (userId, variantId) => {
  // Check if already favorited
  const existing = await prisma.favorite.findUnique({
    where: {
      userId_variantId: {
        userId,
        variantId,
      },
    },
  });

  if (existing) {
    throw new Error('Variant already in favorites');
  }

  // Verify variant exists
  const variant = await prisma.variant.findUnique({
    where: { id: variantId },
  });

  if (!variant) {
    throw new Error('Variant not found');
  }

  const favorite = await prisma.favorite.create({
    data: {
      userId,
      variantId,
    },
    include: {
      variant: true,
    },
  });

  return favorite;
};

export const removeFavorite = async (userId, variantId) => {
  const favorite = await prisma.favorite.findUnique({
    where: {
      userId_variantId: {
        userId,
        variantId,
      },
    },
  });

  if (!favorite) {
    throw new Error('Favorite not found');
  }

  await prisma.favorite.delete({
    where: {
      userId_variantId: {
        userId,
        variantId,
      },
    },
  });

  return { success: true };
};

export const getUserFavorites = async (userId) => {
  const favorites = await prisma.favorite.findMany({
    where: { userId },
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
    },
    orderBy: {
      id: 'desc',
    },
  });

  return favorites;
};


