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

  // Debug: Log what Prisma returns
  console.log(`\n📦 getVariant - Variant ${variantId} from database:`);
  console.log(`   - Has planGeometry field: ${'planGeometry' in variant}`);
  console.log(`   - planGeometry value:`, variant.planGeometry);
  console.log(`   - planGeometry type: ${typeof variant.planGeometry}`);
  console.log(`   - All variant keys:`, Object.keys(variant));
  
  if (variant.planGeometry) {
    const walls = variant.planGeometry?.geometry?.walls || [];
    console.log(`   - planGeometry.geometry.walls count: ${walls.length}`);
  } else {
    console.log(`   ⚠️  planGeometry is null or undefined in database`);
  }

  return variant;
};

export const getPublicVariant = async (variantId) => {
  const variant = await getVariant(variantId);
  // Return variant without sensitive user data
  return variant;
};


