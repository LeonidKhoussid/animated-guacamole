import prisma from '../models/prisma.js';
import { generateToken, generateAdminToken } from '../utils/jwt.js';
import bcrypt from 'bcryptjs';

export const registerUser = async (fullName, phone, password) => {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { phone },
  });

  if (existingUser) {
    throw new Error('User with this phone number already exists');
  }

  // Hash password if provided
  const passwordHash = password ? await bcrypt.hash(password, 10) : null;

  // Create user
  const user = await prisma.user.create({
    data: {
      fullName,
      phone,
      passwordHash,
    },
  });

  // Generate token
  const token = generateToken({ userId: user.id, phone: user.phone });

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
    },
    token,
  };
};

export const loginUser = async (phone, password) => {
  const user = await prisma.user.findUnique({
    where: { phone },
  });

  if (!user) {
    throw new Error('Invalid phone number or password');
  }

  // If password is set, verify it
  if (user.passwordHash && password) {
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid phone number or password');
    }
  }

  const token = generateToken({ userId: user.id, phone: user.phone });

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
    },
    token,
  };
};

export const loginAdmin = async (email, password) => {
  const admin = await prisma.adminUser.findUnique({
    where: { email },
  });

  if (!admin) {
    throw new Error('Invalid email or password');
  }

  const isValid = await bcrypt.compare(password, admin.passwordHash);
  if (!isValid) {
    throw new Error('Invalid email or password');
  }

  const token = generateAdminToken({ adminId: admin.id, email: admin.email });

  return {
    admin: {
      id: admin.id,
      email: admin.email,
    },
    token,
  };
};


