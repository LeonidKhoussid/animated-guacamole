-- Fix Database Encoding Script
-- Run this in psql or your PostgreSQL client

-- Step 1: Connect to postgres database
\c postgres

-- Step 2: Drop the existing database
DROP DATABASE IF EXISTS plan_ai;

-- Step 3: Create database with UTF8 encoding
CREATE DATABASE plan_ai 
WITH ENCODING 'UTF8' 
LC_COLLATE='en_US.UTF-8' 
LC_CTYPE='en_US.UTF-8' 
TEMPLATE template0;

-- Step 4: Connect to the new database
\c plan_ai

-- Done! Now run: npm run prisma:migrate

