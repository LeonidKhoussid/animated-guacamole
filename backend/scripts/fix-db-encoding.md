# Fixing Database Encoding Issue

The error indicates your PostgreSQL database is using WIN1252 encoding, which doesn't support Cyrillic (Russian) characters.

## Option 1: Update DATABASE_URL (Quick Fix)

Add `client_encoding=UTF8` to your DATABASE_URL in `.env`:

```env
DATABASE_URL=postgresql://postgres@localhost:5432/plan_ai?schema=public&client_encoding=UTF8
```

## Option 2: Recreate Database with UTF8 Encoding (Recommended)

If the database server encoding is WIN1252, you need to recreate the database:

1. **Backup your data** (if you have important data):
   ```bash
   pg_dump -U postgres plan_ai > backup.sql
   ```

2. **Drop and recreate the database with UTF8 encoding**:
   ```sql
   -- Connect to PostgreSQL
   psql -U postgres
   
   -- Drop the database
   DROP DATABASE plan_ai;
   
   -- Create with UTF8 encoding
   CREATE DATABASE plan_ai WITH ENCODING 'UTF8' LC_COLLATE='en_US.UTF-8' LC_CTYPE='en_US.UTF-8';
   ```

3. **Run migrations again**:
   ```bash
   cd backend
   npm run prisma:migrate
   ```

4. **Restore data** (if you backed up):
   ```bash
   psql -U postgres plan_ai < backup.sql
   ```

## Option 3: Check Current Encoding

Run the check script to see current encoding:

```bash
cd backend
node scripts/check-db-encoding.js
```

This will show you the database, client, and server encoding settings.


