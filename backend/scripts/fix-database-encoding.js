import { execSync } from 'child_process';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get DATABASE_URL from .env
const envPath = join(__dirname, '..', '.env');
if (!existsSync(envPath)) {
  console.error('❌ .env file not found!');
  process.exit(1);
}

const envContent = readFileSync(envPath, 'utf-8');
const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
if (!dbUrlMatch) {
  console.error('❌ DATABASE_URL not found in .env file!');
  process.exit(1);
}

const dbUrl = dbUrlMatch[1].trim();
// Parse DATABASE_URL: postgresql://user@host:port/database
const urlMatch = dbUrl.match(/postgresql:\/\/([^@]+)@([^:]+):(\d+)\/([^?]+)/);
if (!urlMatch) {
  console.error('❌ Invalid DATABASE_URL format!');
  console.error('   Expected format: postgresql://user@host:port/database');
  process.exit(1);
}

const [, user, host, port, database] = urlMatch;

console.log('📋 Database Information:');
console.log(`   Host: ${host}`);
console.log(`   Port: ${port}`);
console.log(`   Database: ${database}`);
console.log(`   User: ${user}`);
console.log('');

// Check if psql is available
try {
  execSync('psql --version', { stdio: 'ignore' });
} catch (error) {
  console.error('❌ psql command not found!');
  console.error('');
  console.error('For DBngin on Windows, psql is usually located at:');
  console.error('   C:\\Program Files\\DBngin\\resources\\postgresql-XX\\bin\\psql.exe');
  console.error('');
  console.error('Please add PostgreSQL bin directory to your PATH or run the SQL script manually.');
  console.error('');
  console.error('Creating SQL script file instead...');
  
  // Create SQL script as fallback
  const sqlScript = `-- Fix Database Encoding Script
-- Run this in psql or your PostgreSQL client

-- Step 1: Connect to postgres database
\\c postgres

-- Step 2: Drop the existing database
DROP DATABASE IF EXISTS ${database};

-- Step 3: Create database with UTF8 encoding
CREATE DATABASE ${database} 
WITH ENCODING 'UTF8' 
LC_COLLATE='en_US.UTF-8' 
LC_CTYPE='en_US.UTF-8' 
TEMPLATE template0;

-- Step 4: Connect to the new database
\\c ${database}

-- Done! Now run: npm run prisma:migrate
`;
  
  const sqlPath = join(__dirname, '..', 'fix-encoding.sql');
  writeFileSync(sqlPath, sqlScript);
  console.log(`✅ SQL script created: ${sqlPath}`);
  console.log('');
  console.log('To fix the encoding:');
  console.log(`1. Run: psql -h ${host} -p ${port} -U ${user} -d postgres -f fix-encoding.sql`);
  console.log('2. Then run: npm run prisma:migrate');
  process.exit(1);
}

try {
  console.log('🔄 Step 1: Checking current database encoding...');
  const checkEncoding = `psql -h ${host} -p ${port} -U ${user} -d ${database} -t -A -c "SELECT pg_encoding_to_char(encoding) FROM pg_database WHERE datname = '${database}';"`;
  let currentEncoding;
  try {
    currentEncoding = execSync(checkEncoding, { encoding: 'utf-8', stdio: 'pipe' }).trim();
  } catch (err) {
    // Database might not exist, that's okay
    currentEncoding = 'UNKNOWN';
  }
  
  if (currentEncoding === 'UTF8' || currentEncoding === '') {
    console.log(`   Current encoding: ${currentEncoding || 'UNKNOWN'}`);
    if (currentEncoding === 'UTF8') {
      console.log('✅ Database already uses UTF8 encoding!');
      process.exit(0);
    }
  } else {
    console.log(`   Current encoding: ${currentEncoding}`);
  }
  
  console.log('');
  console.log('⚠️  Database needs to be recreated with UTF8 encoding...');
  console.log('');
  
  console.log('🔄 Step 2: Creating backup of schema (if database exists)...');
  const backupFile = join(__dirname, '..', 'backup_schema.sql');
  try {
    const backupCmd = `pg_dump -h ${host} -p ${port} -U ${user} -d ${database} --schema-only -f "${backupFile}"`;
    execSync(backupCmd, { stdio: 'inherit' });
    console.log(`   ✅ Schema backed up to: ${backupFile}`);
  } catch (err) {
    console.log('   ⚠️  Could not backup schema (database might not exist)');
  }
  console.log('');
  
  console.log('🔄 Step 3: Dropping existing database...');
  const dropCmd = `psql -h ${host} -p ${port} -U ${user} -d postgres -c "DROP DATABASE IF EXISTS \\"${database}\\";"`;
  execSync(dropCmd, { stdio: 'inherit' });
  console.log('   ✅ Database dropped');
  console.log('');
  
  console.log('🔄 Step 4: Creating database with UTF8 encoding...');
  // Use template0 which is always UTF8
  const createCmd = `psql -h ${host} -p ${port} -U ${user} -d postgres -c "CREATE DATABASE \\"${database}\\" WITH ENCODING 'UTF8' TEMPLATE template0;"`;
  execSync(createCmd, { stdio: 'inherit' });
  console.log('   ✅ Database created with UTF8 encoding');
  console.log('');
  
  console.log('🔄 Step 5: Running Prisma migrations to recreate schema...');
  process.chdir(join(__dirname, '..'));
  execSync('npm run prisma:migrate', { stdio: 'inherit' });
  console.log('   ✅ Migrations completed');
  console.log('');
  
  console.log('✅ Database successfully recreated with UTF8 encoding!');
  console.log('');
  console.log('⚠️  Note: All data in the database was lost.');
  console.log('   You may need to re-register users and re-upload plans.');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('');
  console.error('Troubleshooting:');
  console.error('1. Make sure PostgreSQL is running in DBngin');
  console.error('2. Check that psql is in your PATH');
  console.error('3. Verify DATABASE_URL in .env is correct');
  console.error('4. Try running the SQL script manually (fix-encoding.sql)');
  process.exit(1);
}

