import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getProjectRole } from '@/lib/project-auth';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  status: z.enum(['Planning', 'Active', 'Completed', 'Archived']).optional(),
  startDate: z.string().optional().nullable(),
  targetDate: z.string().optional().nullable(),
});

// GET: get project details with members
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.response;
  const user = auth.user;

  const { id } = await context.params;
  const perm = await getProjectRole(id, user.id);
  if (!perm.authorized) {
    return NextResponse.json({ error: perm.error }, { status: perm.statusCode || 403 });
  }

  const project = await prisma.project.findUnique({
    where: { id },
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
        orderBy: { joinedAt: 'asc' },
      },
      bomItems: {
        include: {
          createdBy: {
            select: { id: true, username: true, name: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      _count: {
        select: { members: true, bomItems: true },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  return NextResponse.json({
    project,
    currentUserRole: perm.role,
    memberCount: project.members.length,
    maxMembers: 6,
  });
}

// PATCH: update project
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.response;
  const user = auth.user;

  const { id } = await context.params;
  const perm = await getProjectRole(id, user.id);
  if (!perm.authorized) {
    return NextResponse.json({ error: perm.error }, { status: perm.statusCode || 403 });
  }

  if (perm.role !== 'OWNER' && perm.role !== 'EDITOR') {
    return NextResponse.json({ error: 'Only project owners and editors can update project settings.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = updateProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const data: any = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.description !== undefined) data.description = parsed.data.description;
    if (parsed.data.status !== undefined) data.status = parsed.data.status;
    if (parsed.data.startDate !== undefined) {
      data.startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : null;
    }
    if (parsed.data.targetDate !== undefined) {
      data.targetDate = parsed.data.targetDate ? new Date(parsed.data.targetDate) : null;
    }

    const updated = await prisma.project.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, project: updated });
  } catch (error) {
    console.error('PATCH /api/projects/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update project.' }, { status: 500 });
  }
}

// DELETE: delete project (OWNER only)
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.response;
  const user = auth.user;

  const { id } = await context.params;
  const perm = await getProjectRole(id, user.id);
  if (!perm.authorized) {
    return NextResponse.json({ error: perm.error }, { status: perm.statusCode || 403 });
  }

  if (perm.role !== 'OWNER') {
    return NextResponse.json({ error: 'Only the project owner can delete this project.' }, { status: 403 });
  }

  try {
    await prisma.project.delete({
      where: { id },
    });
    return NextResponse.json({ success: true, message: 'Project deleted successfully.' });
  } catch (error) {
    console.error('DELETE /api/projects/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete project.' }, { status: 500 });
  }
}
