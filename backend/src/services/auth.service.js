import prisma from '../models/prisma.js';
import { generateToken, generateAdminToken } from '../utils/jwt.js';
import bcrypt from 'bcryptjs';
import { ensureUTF8Encoding } from '../models/prisma.js';

export const registerUser = async (fullName, phone, password) => {
  // Ensure UTF-8 encoding
  await ensureUTF8Encoding();
  
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
  // Ensure UTF-8 encoding
  await ensureUTF8Encoding();
  
  let user = await prisma.user.findUnique({
    where: { phone },
  });

  // Auto-register user if they don't exist (since password is optional)
  if (!user) {
    // Hash password if provided
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    
    // Create user with phone number as default name
    user = await prisma.user.create({
      data: {
        fullName: phone, // Use phone as default name
        phone,
        passwordHash,
      },
    });
  } else {
    // If password is set, verify it
    if (user.passwordHash && password) {
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        throw new Error('Invalid phone number or password');
      }
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


