import * as variantsService from '../services/variants.service.js';

export const getVariant = async (request, reply) => {
  try {
    const { id } = request.params;
    const variant = await variantsService.getVariant(id);
    
    // Debug: Log what we're sending
    console.log(`\n📤 getVariant controller - Sending variant ${id}:`);
    console.log(`   - Has planGeometry: ${!!variant.planGeometry}`);
    console.log(`   - planGeometry type: ${typeof variant.planGeometry}`);
    console.log(`   - planGeometry value:`, JSON.stringify(variant.planGeometry, null, 2).substring(0, 500));
    
    // CRITICAL FIX: Fastify has issues serializing Prisma JsonValue types
    // We need to manually serialize planGeometry to ensure it's a plain object
    // The issue is that Prisma returns JsonValue which Fastify doesn't serialize correctly
    let serializedPlanGeometry = null;
    if (variant.planGeometry) {
      try {
        // Force deep serialization by stringifying and parsing
        const planGeometryJson = JSON.stringify(variant.planGeometry);
        serializedPlanGeometry = JSON.parse(planGeometryJson);
        console.log(`   ✅ Force-serialized planGeometry, JSON length: ${planGeometryJson.length}`);
        console.log(`   - Serialized keys:`, Object.keys(serializedPlanGeometry));
        console.log(`   - Has geometry:`, !!serializedPlanGeometry.geometry);
        console.log(`   - Has walls:`, !!serializedPlanGeometry.geometry?.walls);
        console.log(`   - Walls count:`, serializedPlanGeometry.geometry?.walls?.length || 0);
        console.log(`   - Full structure:`, JSON.stringify(serializedPlanGeometry, null, 2).substring(0, 500));
      } catch (err) {
        console.error(`   ❌ Failed to force-serialize planGeometry:`, err);
        serializedPlanGeometry = variant.planGeometry;
      }
    }
    
    // Create a completely fresh object without any Prisma-specific properties
    // This ensures Fastify can serialize it correctly
    const responseData = {
      id: variant.id,
      aiRequestId: variant.aiRequestId,
      thumbnailUrl: variant.thumbnailUrl,
      model3dUrl: variant.model3dUrl,
      description: variant.description,
      normativeExplanation: variant.normativeExplanation,
      approvalProbability: variant.approvalProbability,
      planGeometry: serializedPlanGeometry, // This should now be a plain object
      createdAt: variant.createdAt,
    };
    
    // Final verification before sending
    console.log(`   - Response data planGeometry exists: ${!!responseData.planGeometry}`);
    if (responseData.planGeometry) {
      const walls = responseData.planGeometry?.geometry?.walls || [];
      console.log(`   - Response data walls count: ${walls.length}`);
      console.log(`   - Response data planGeometry keys:`, Object.keys(responseData.planGeometry));
      // Verify it can be stringified
      try {
        const testJson = JSON.stringify(responseData.planGeometry);
        console.log(`   - ✅ planGeometry can be stringified, length: ${testJson.length}`);
      } catch (err) {
        console.error(`   - ❌ planGeometry cannot be stringified:`, err);
      }
    }
    
    // Explicitly set content type
    reply.type('application/json');
    return reply.send(responseData);
  } catch (error) {
    if (error.message === 'Variant not found') {
      return reply.code(404).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};

export const getPublicVariant = async (request, reply) => {
  try {
    const { variant_id } = request.params;
    const variant = await variantsService.getPublicVariant(variant_id);
    return reply.send(variant);
  } catch (error) {
    if (error.message === 'Variant not found') {
      return reply.code(404).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
};

export const get3DModelModifications = async (request, reply) => {
  try {
    const { id } = request.params;
    const modifications = await variantsService.get3DModelModifications(id);
    return reply.send(modifications);
  } catch (error) {
    if (error.message === 'Variant not found') {
      return reply.code(404).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to get 3D model modifications' });
  }
};


