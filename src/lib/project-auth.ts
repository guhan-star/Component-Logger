import prisma from '@/lib/prisma';

export type ProjectRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface ProjectPermissionResult {
  authorized: boolean;
  role: ProjectRole | null;
  project: any | null;
  error?: string;
  statusCode?: number;
}

/**
 * Checks if a user has access to a project and determines their role.
 */
export async function getProjectRole(
  projectId: string,
  userId: string
): Promise<ProjectPermissionResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, username: true, name: true, avatarUrl: true },
          },
        },
      },
    },
  });

  if (!project) {
    return {
      authorized: false,
      role: null,
      project: null,
      error: 'Project not found.',
      statusCode: 404,
    };
  }

  // Check if owner
  if (project.ownerId === userId) {
    return { authorized: true, role: 'OWNER', project };
  }

  // Check if member
  const member = project.members.find((m) => m.userId === userId);
  if (member) {
    return { authorized: true, role: member.role as ProjectRole, project };
  }

  return {
    authorized: false,
    role: null,
    project: null,
    error: 'You do not have permission to access this project.',
    statusCode: 403,
  };
}

/**
 * Enforces strict project team cap of 6 members (1 Owner + up to 5 members).
 */
export const MAX_PROJECT_MEMBERS = 6;

export async function canAddMember(projectId: string): Promise<{ allowed: boolean; currentCount: number }> {
  const count = await prisma.projectMember.count({
    where: { projectId },
  });
  return { allowed: count < MAX_PROJECT_MEMBERS, currentCount: count };
}
