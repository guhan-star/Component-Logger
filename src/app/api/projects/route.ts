import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';

const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(100),
  description: z.string().trim().max(500).optional().nullable(),
  status: z.enum(['Planning', 'Active', 'Completed', 'Archived']).default('Active'),
  startDate: z.string().optional().nullable(),
  targetDate: z.string().optional().nullable(),
});

// GET: list all projects where user is Owner or a Member
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.response;
  const user = auth.user;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: any = {
      OR: [
        { ownerId: user.id },
        { members: { some: { userId: user.id } } },
      ],
    };

    if (status) {
      where.status = status;
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        owner: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, username: true, name: true, avatarUrl: true },
            },
          },
        },
        _count: {
          select: {
            members: true,
            bomItems: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Annotate user's specific role in each project
    const annotated = projects.map((p) => {
      let role = 'VIEWER';
      if (p.ownerId === user.id) {
        role = 'OWNER';
      } else {
        const mem = p.members.find((m) => m.userId === user.id);
        if (mem) role = mem.role;
      }

      return {
        ...p,
        currentUserRole: role,
        memberCount: p.members.length,
        maxMembers: 6,
      };
    });

    return NextResponse.json({ data: annotated });
  } catch (error) {
    console.error('GET /api/projects error:', error);
    return NextResponse.json({ error: 'Failed to retrieve projects.' }, { status: 500 });
  }
}

// POST: create a new project
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.response;
  const user = auth.user;

  try {
    const body = await request.json();
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid project parameters.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Create project and assign creator as OWNER in ProjectMember atomically
    const newProject = await prisma.$transaction(async (tx) => {
      const proj = await tx.project.create({
        data: {
          name: data.name,
          description: data.description,
          status: data.status,
          startDate: data.startDate ? new Date(data.startDate) : null,
          targetDate: data.targetDate ? new Date(data.targetDate) : null,
          ownerId: user.id,
        },
      });

      // Add owner as the first member (role = OWNER)
      await tx.projectMember.create({
        data: {
          projectId: proj.id,
          userId: user.id,
          role: 'OWNER',
        },
      });

      return proj;
    });

    return NextResponse.json({ success: true, project: newProject }, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects error:', error);
    return NextResponse.json({ error: 'Failed to create project.' }, { status: 500 });
  }
}
