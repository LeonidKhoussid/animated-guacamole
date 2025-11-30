import * as variantsService from '../services/variants.service.js';

export const getVariant = async (request, reply) => {
  try {
    const { id } = request.params;
    const variant = await variantsService.getVariant(id);
    
    // Debug: Log what we're sending
    console.log(`\n📤 getVariant controller - Sending variant ${id}:`);
    console.log(`   - Has planGeometry: ${!!variant.planGeometry}`);
    console.log(`   - planGeometry type: ${typeof variant.planGeometry}`);
    console.log(`   - All keys in variant:`, Object.keys(variant));
    
    return reply.send(variant);
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


