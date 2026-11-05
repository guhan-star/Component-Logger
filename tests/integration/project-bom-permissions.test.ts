import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { getProjectRole, canAddMember, MAX_PROJECT_MEMBERS } from '@/lib/project-auth';

describe('Integration Tests: Project Team Permissions & 6-Member Cap', () => {
  const ownerId = 'usr_owner_001';
  const editorId = 'usr_editor_002';
  const viewerId = 'usr_viewer_003';
  const outsiderId = 'usr_outsider_999';

  const mockProject = {
    id: 'proj_stark_reactor_01',
    name: 'Arc Reactor Miniaturization',
    ownerId,
    status: 'Active',
    members: [
      { id: 'mem_1', userId: ownerId, role: 'OWNER', user: { id: ownerId } },
      { id: 'mem_2', userId: editorId, role: 'EDITOR', user: { id: editorId } },
      { id: 'mem_3', userId: viewerId, role: 'VIEWER', user: { id: viewerId } },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(prisma.project, 'findUnique').mockResolvedValue(mockProject as any);
  });

  it('correctly identifies OWNER permissions', async () => {
    const res = await getProjectRole(mockProject.id, ownerId);
    expect(res.authorized).toBe(true);
    expect(res.role).toBe('OWNER');
    expect(res.project.id).toBe(mockProject.id);
  });

  it('correctly identifies EDITOR permissions', async () => {
    const res = await getProjectRole(mockProject.id, editorId);
    expect(res.authorized).toBe(true);
    expect(res.role).toBe('EDITOR');
  });

  it('correctly identifies VIEWER permissions', async () => {
    const res = await getProjectRole(mockProject.id, viewerId);
    expect(res.authorized).toBe(true);
    expect(res.role).toBe('VIEWER');
  });

  it('STRICT SECURITY: Rejects outsider user with HTTP 403 authorization failure', async () => {
    const res = await getProjectRole(mockProject.id, outsiderId);
    expect(res.authorized).toBe(false);
    expect(res.role).toBeNull();
    expect(res.statusCode).toBe(403);
    expect(res.error).toContain('permission');
  });

  it('STRICT TEAM LIMIT: Enforces MAX_PROJECT_MEMBERS = 6 and rejects 7th member', async () => {
    expect(MAX_PROJECT_MEMBERS).toBe(6);

    // When 5 members are in project, adding a 6th is allowed
    vi.spyOn(prisma.projectMember, 'count').mockResolvedValue(5);
    const check5 = await canAddMember(mockProject.id);
    expect(check5.allowed).toBe(true);
    expect(check5.currentCount).toBe(5);

    // When 6 members exist, adding a 7th is strictly rejected
    vi.spyOn(prisma.projectMember, 'count').mockResolvedValue(6);
    const check6 = await canAddMember(mockProject.id);
    expect(check6.allowed).toBe(false);
    expect(check6.currentCount).toBe(6);
  });
});
