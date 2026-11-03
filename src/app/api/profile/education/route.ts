import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';

const currentYearNum = new Date().getFullYear();

const educationSchema = z.object({
  id: z.string().optional(),
  institutionName: z.string().trim().min(2, 'College or university name is required').max(150),
  department: z.string().trim().max(100).optional().nullable(),
  degree: z.string().trim().max(80).optional().nullable(),
  course: z.string().trim().max(80).optional().nullable(),
  specialization: z.string().trim().max(80).optional().nullable(),
  academicStatus: z.enum(['Studying', 'Graduated', 'Postgraduate', 'Other']).default('Studying'),
  currentYear: z.number().int().min(1).max(10).optional().nullable(),
  admissionYear: z.number().int().min(1950).max(currentYearNum + 2).optional().nullable(),
  expectedGraduationYear: z.number().int().min(1950).max(currentYearNum + 15).optional().nullable(),
  passoutYear: z.number().int().min(1950).max(currentYearNum + 15).optional().nullable(),
  location: z.string().trim().max(100).optional().nullable(),
  collegeEmail: z.string().trim().email('Invalid college email format').optional().nullable().or(z.literal('')),
  portfolioUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  githubUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  linkedinUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  websiteUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  isPrimary: z.boolean().default(true),
}).refine(
  (data) => {
    if (data.admissionYear && data.expectedGraduationYear) {
      return data.expectedGraduationYear >= data.admissionYear;
    }
    return true;
  },
  {
    message: 'Expected graduation year must be after or same as admission year',
    path: ['expectedGraduationYear'],
  }
).refine(
  (data) => {
    if (data.academicStatus === 'Graduated' && data.admissionYear && data.passoutYear) {
      return data.passoutYear >= data.admissionYear;
    }
    return true;
  },
  {
    message: 'Year of passing out must be after admission year',
    path: ['passoutYear'],
  }
);

// GET /api/profile/education - Fetch authenticated user education records
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const educations = await prisma.userEducation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ educations, count: educations.length });
  } catch (error) {
    console.error('GET /api/profile/education error:', error);
    return NextResponse.json({ error: 'Failed to fetch education records' }, { status: 500 });
  }
}

// PUT /api/profile/education - Create or update primary education record
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const body = await request.json();
    const parsed = educationSchema.safeParse(body);

    if (!parsed.success) {
      const err = parsed.error.issues[0]?.message || 'Invalid education details';
      return NextResponse.json({ error: err }, { status: 400 });
    }

    const data = parsed.data;

    // If an ID is provided, verify it belongs to this user
    let existingRecord: any = null;
    if (data.id) {
      existingRecord = await prisma.userEducation.findFirst({
        where: { id: data.id, userId: user.id },
      });
      if (!existingRecord) {
        return NextResponse.json({ error: 'Education record not found' }, { status: 404 });
      }
    } else {
      // Check for primary record
      existingRecord = await prisma.userEducation.findFirst({
        where: { userId: user.id, isPrimary: true },
      });
    }

    const eduData: any = {
      institutionName: data.institutionName,
      department: data.department || null,
      degree: data.degree || null,
      course: data.course || null,
      specialization: data.specialization || null,
      academicStatus: data.academicStatus || 'Studying',
      currentYear: data.currentYear || null,
      admissionYear: data.admissionYear || null,
      expectedGraduationYear: data.expectedGraduationYear || null,
      passoutYear: data.passoutYear || null,
      location: data.location || null,
      collegeEmail: data.collegeEmail || null,
      portfolioUrl: data.portfolioUrl || null,
      githubUrl: data.githubUrl || null,
      linkedinUrl: data.linkedinUrl || null,
      websiteUrl: data.websiteUrl || null,
      isPrimary: true,
    };

    let result;
    if (existingRecord) {
      result = await prisma.userEducation.update({
        where: { id: existingRecord.id },
        data: eduData,
      });
    } else {
      result = await prisma.userEducation.create({
        data: {
          userId: user.id,
          ...eduData,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Education information saved successfully',
      education: result,
    });
  } catch (error: any) {
    console.error('PUT /api/profile/education error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update education details' }, { status: 500 });
  }
}
