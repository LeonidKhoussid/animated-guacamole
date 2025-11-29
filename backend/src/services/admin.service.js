import prisma from '../models/prisma.js';
import bcrypt from 'bcryptjs';

export const createAdminUser = async (email, password) => {
  const existingAdmin = await prisma.adminUser.findUnique({
    where: { email },
  });

  if (existingAdmin) {
    throw new Error('Admin user already exists');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.adminUser.create({
    data: {
      email,
      passwordHash,
    },
  });

  return admin;
};


