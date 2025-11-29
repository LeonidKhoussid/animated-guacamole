import prisma from '../src/models/prisma.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const createAdmin = async () => {
  const email = process.argv[2] || 'admin@example.com';
  const password = process.argv[3] || 'admin123';

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    
    const admin = await prisma.adminUser.create({
      data: {
        email,
        passwordHash,
      },
    });

    console.log('Admin user created successfully!');
    console.log('Email:', admin.email);
    console.log('ID:', admin.id);
  } catch (error) {
    if (error.code === 'P2002') {
      console.error('Admin user with this email already exists');
    } else {
      console.error('Error creating admin user:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
};

createAdmin();


