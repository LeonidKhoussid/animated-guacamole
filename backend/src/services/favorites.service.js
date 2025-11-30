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
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId },
      include: {
        variant: {
          include: {
            aiRequest: {
              include: {
                plan: {
                  select: {
                    id: true,
                    fileUrl: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        id: 'desc',
      },
    });

    console.log(`Found ${favorites.length} favorites for user ${userId}`);
    
    // Filter out favorites where variant was deleted
    const validFavorites = favorites.filter(fav => {
      if (!fav.variant) {
        console.warn(`Favorite ${fav.id} has null variant, filtering out`);
        return false;
      }
      return true;
    });
    
    console.log(`Returning ${validFavorites.length} valid favorites`);
    return validFavorites;
  } catch (error) {
    console.error('Error in getUserFavorites:', error);
    throw error;
  }
};


