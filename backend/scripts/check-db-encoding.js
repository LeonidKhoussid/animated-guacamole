import prisma from '../src/models/prisma.js';

async function checkDatabaseEncoding() {
  try {
    // Check database encoding
    const result = await prisma.$queryRawUnsafe(`
      SELECT 
        datname as database_name,
        pg_encoding_to_char(encoding) as encoding
      FROM pg_database 
      WHERE datname = current_database();
    `);
    
    console.log('Database encoding:', result);
    
    // Check current client encoding
    const clientEncoding = await prisma.$queryRawUnsafe(`SHOW client_encoding`);
    console.log('Client encoding:', clientEncoding);
    
    // Check server encoding
    const serverEncoding = await prisma.$queryRawUnsafe(`SHOW server_encoding`);
    console.log('Server encoding:', serverEncoding);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error checking encoding:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkDatabaseEncoding();

