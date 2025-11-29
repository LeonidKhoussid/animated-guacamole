import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env') });

async function fixDatabaseEncoding() {
  let prisma = null;
  let adminPrisma = null;
  
  try {
    console.log('🔄 Fixing database encoding...');
    console.log('');
    
    // Get database name from DATABASE_URL
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.error('❌ DATABASE_URL not found in environment!');
      process.exit(1);
    }
    
    // Parse DATABASE_URL to get connection details
    const urlMatch = dbUrl.match(/postgresql:\/\/([^@]+)@([^:]+):(\d+)\/([^?]+)/);
    if (!urlMatch) {
      console.error('❌ Invalid DATABASE_URL format!');
      process.exit(1);
    }
    
    const [, user, host, port, database] = urlMatch;
    
    console.log(`📋 Database: ${database}`);
    console.log(`   Host: ${host}:${port}`);
    console.log(`   User: ${user}`);
    console.log('');
    
    // Create admin connection to 'postgres' database
    const adminUrl = `postgresql://${user}@${host}:${port}/postgres`;
    adminPrisma = new PrismaClient({
      datasources: {
        db: {
          url: adminUrl,
        },
      },
    });
    
    await adminPrisma.$connect();
    console.log('✅ Connected to postgres database');
    console.log('');
    
    // Check current encoding
    console.log('🔄 Step 1: Checking current encoding...');
    try {
      const encodingResult = await adminPrisma.$queryRawUnsafe(`
        SELECT pg_encoding_to_char(encoding) as encoding 
        FROM pg_database 
        WHERE datname = '${database}';
      `);
      const currentEncoding = encodingResult[0]?.encoding;
      console.log(`   Current encoding: ${currentEncoding || 'Database does not exist'}`);
      
      if (currentEncoding === 'UTF8') {
        console.log('');
        console.log('✅ Database already uses UTF8 encoding!');
        await adminPrisma.$disconnect();
        process.exit(0);
      }
    } catch (err) {
      console.log('   ⚠️  Could not check encoding (database might not exist)');
    }
    
    console.log('');
    console.log('⚠️  WARNING: This will DROP and recreate the database!');
    console.log('   All data will be lost!');
    console.log('');
    
    // Disconnect from target database if connected
    prisma = new PrismaClient();
    try {
      await prisma.$disconnect();
    } catch (e) {}
    
    console.log('🔄 Step 2: Terminating all connections to the database...');
    try {
      await adminPrisma.$executeRawUnsafe(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = '${database}'
          AND pid <> pg_backend_pid();
      `);
      console.log('   ✅ All connections terminated');
    } catch (err) {
      console.log('   ⚠️  Could not terminate connections (might not be necessary)');
    }
    console.log('');
    
    // Wait a moment for connections to close
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('🔄 Step 3: Dropping existing database...');
    await adminPrisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}";`);
    console.log('   ✅ Database dropped');
    console.log('');
    
    console.log('🔄 Step 4: Creating database with UTF8 encoding...');
    await adminPrisma.$executeRawUnsafe(`
      CREATE DATABASE "${database}" 
      WITH ENCODING 'UTF8' 
      TEMPLATE template0;
    `);
    console.log('   ✅ Database created with UTF8 encoding');
    console.log('');
    
    await adminPrisma.$disconnect();
    
    console.log('🔄 Step 5: Running Prisma migrations...');
    process.chdir(join(__dirname, '..'));
    execSync('npm run prisma:migrate', { stdio: 'inherit' });
    console.log('   ✅ Migrations completed');
    console.log('');
    
    console.log('✅ Database successfully recreated with UTF8 encoding!');
    console.log('');
    console.log('⚠️  Note: All previous data was lost.');
    console.log('   You may need to re-register users and re-upload plans.');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('');
    if (error.stack) {
      console.error('Error details:', error.stack);
    }
    try {
      if (prisma) await prisma.$disconnect();
      if (adminPrisma) await adminPrisma.$disconnect();
    } catch (e) {}
    process.exit(1);
  }
}

fixDatabaseEncoding();

