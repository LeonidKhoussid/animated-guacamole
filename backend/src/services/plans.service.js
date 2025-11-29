import prisma from '../models/prisma.js';
import { saveFile, generateFilename, validateFileType, getFileUrl } from '../utils/fileStorage.js';

export const uploadPlan = async (userId, file) => {
  // Validate file type
  if (!validateFileType(file.mimetype)) {
    throw new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.');
  }

  // Generate filename
  const filename = generateFilename(file.filename, 'plan_');
  
  // Save file (returns S3 URL or local path)
  const savedPath = await saveFile(file, filename);
  
  // Get file URL (if savedPath is already a URL, getFileUrl will return it as-is)
  const fileUrl = getFileUrl(savedPath);

  // Create plan record
  const plan = await prisma.plan.create({
    data: {
      userId,
      fileUrl,
      analysisJson: null, // Will be populated by AI service later
    },
  });

  return plan;
};

export const getPlan = async (planId, userId) => {
  const plan = await prisma.plan.findFirst({
    where: {
      id: planId,
      userId, // Ensure user owns the plan
    },
  });

  if (!plan) {
    throw new Error('Plan not found');
  }

  return plan;
};


