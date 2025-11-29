import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

// Helper function to ensure UTF8 encoding is set
export const ensureUTF8Encoding = async () => {
  try {
    await prisma.$executeRawUnsafe(`SET client_encoding TO 'UTF8'`);
    return true;
  } catch (err) {
    console.warn('Failed to set UTF8 encoding:', err.message);
    return false;
  }
};

// Set encoding on initial connection
(async () => {
  try {
    await prisma.$connect();
    await ensureUTF8Encoding();
    console.log('✓ Database connection established with UTF8 encoding');
  } catch (err) {
    console.warn('Could not set UTF8 encoding on initial connection:', err.message);
  }
})();

export default prisma;


