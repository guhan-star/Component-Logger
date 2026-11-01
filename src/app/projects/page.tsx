'use client';

import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Plus,
  Users,
  Shield,
  Trash2,
  Calendar,
  Clock,
  Layers,
  AlertCircle,
  Check,
  X,
  Share2,
  ExternalLink,
  Lock,
  UserPlus,
  LogOut,
  Info,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';

interface TeamMember {
  id: string;
  userId: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  user: {
    id: string;
    username: string;
    name: string;
    avatarUrl: string | null;
  };
}

interface BomItem {
  id: string;
  name: string;
  category?: string | null;
  subcategory?: string | null;
  manufacturer?: string | null;
  mpn?: string | null;
  model?: string | null;
  description?: string | null;
  specifications?: string | null;
  quantityRequired: number;
  unit: string;
  notes?: string | null;
  imageUrl?: string | null;
  datasheetUrl?: string | null;
  sourceComponentId?: string | null;
  createdById: string;
  createdBy: {
    id: string;
    username: string;
    name: string;
  };
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  startDate?: string | null;
  targetDate?: string | null;
  ownerId: string;
  owner: {
    id: string;
    username: string;
    name: string;
  };
  members: TeamMember[];
  bomItems: BomItem[];
  currentUserRole: 'OWNER' | 'EDITOR' | 'VIEWER';
  memberCount: number;
  maxMembers: number;
}

interface FriendOption {
  id: string;
  username: string;
  name: string;
}

interface ComponentOption {
  id: string;
  name: string;
  category?: string;
  manufacturer?: string;
  mpn?: string;
  unitOfMeasurement?: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [friends, setFriends] = useState<FriendOption[]>([]);
  const [myComponents, setMyComponents] = useState<ComponentOption[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isAddBomOpen, setIsAddBomOpen] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Forms
  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    status: 'Active' as const,
    startDate: new Date().toISOString().split('T')[0],
    targetDate: '',
  });

  const [inviteForm, setInviteForm] = useState({
    targetUserId: '',
    role: 'VIEWER' as 'EDITOR' | 'VIEWER',
  });

  const [bomMode, setBomMode] = useState<'inventory' | 'custom'>('inventory');
  const [bomForm, setBomForm] = useState({
    sourceComponentId: '',
    name: '',
    category: '',
    manufacturer: '',
    mpn: '',
    quantityRequired: 1,
    unit: 'Piece',
    notes: '',
  });

  const loadAll = async () => {
    try {
      setLoading(true);
      const [projRes, friendsRes, compRes, invRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/friends'),
        fetch('/api/components?pageSize=100'),
        fetch('/api/invitations'),
      ]);

      if (projRes.ok) {
        const pData = await projRes.json();
        // For each project, fetch full details with BOM items
        const detailedProjects = await Promise.all(
          (pData.data || []).map(async (p: any) => {
            const detailRes = await fetch(`/api/projects/${p.id}`);
            if (detailRes.ok) {
              const dData = await detailRes.json();
              return dData.project ? { ...dData.project, currentUserRole: dData.currentUserRole } : p;
            }
            return p;
          })
        );
        setProjects(detailedProjects);
      }

      if (friendsRes.ok) {
        const fData = await friendsRes.json();
        setFriends(fData.friends || []);
      }

      if (compRes.ok) {
        const cData = await compRes.json();
        setMyComponents(cData.data || []);
      }

      if (invRes.ok) {
        const iData = await invRes.json();
        setPendingInvitations(iData.invitations || []);
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to load project workspaces.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create project.');

      setIsCreateOpen(false);
      setProjectForm({
        name: '',
        description: '',
        status: 'Active',
        startDate: new Date().toISOString().split('T')[0],
        targetDate: '',
      });
      setSuccess(`Project "${data.project.name}" created successfully.`);
      loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectId) return;
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/projects/${activeProjectId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invitation.');

      setIsInviteOpen(false);
      setInviteForm({ targetUserId: '', role: 'VIEWER' });
      setSuccess(data.message || 'Invitation sent successfully.');
      loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRespondInvitation = async (invitationId: string, action: 'ACCEPT' | 'REJECT') => {
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/invitations/${invitationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process invitation.');

      setSuccess(data.message);
      loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAddBomItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectId) return;
    setError(null);
    setSuccess(null);

    try {
      let payload: any = {};
      if (bomMode === 'inventory') {
        if (!bomForm.sourceComponentId) {
          setError('Please select a component from your inventory.');
          return;
        }
        payload = {
          sourceComponentId: bomForm.sourceComponentId,
          quantityRequired: Number(bomForm.quantityRequired),
          notes: bomForm.notes,
        };
      } else {
        payload = {
          name: bomForm.name,
          category: bomForm.category,
          manufacturer: bomForm.manufacturer,
          mpn: bomForm.mpn,
          quantityRequired: Number(bomForm.quantityRequired),
          unit: bomForm.unit,
          notes: bomForm.notes,
        };
      }

      const res = await fetch(`/api/projects/${activeProjectId}/bom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add BOM item.');

      setIsAddBomOpen(false);
      setBomForm({
        sourceComponentId: '',
        name: '',
        category: '',
        manufacturer: '',
        mpn: '',
        quantityRequired: 1,
        unit: 'Piece',
        notes: '',
      });
      setSuccess(data.message || 'Added item to collaborative BOM snapshot.');
      loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteBomItem = async (projectId: string, bomId: string, itemName: string) => {
    if (!confirm(`Remove "${itemName}" from project BOM?`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/bom/${bomId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove BOM item.');
      loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLeaveProject = async (projectId: string, currentUserId: string) => {
    if (!confirm('Are you sure you want to leave this project team?')) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/members?userId=${currentUserId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to leave project.');
      setSuccess('You have left the project.');
      loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteProject = async (projectId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete project "${name}"? This action is permanent.`)) return;
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete project.');
      setSuccess(`Project "${name}" deleted.`);
      loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-[var(--amber)]" />
            <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">
              Collaborative Projects &amp; Bill of Materials
            </h1>
          </div>
          <p className="text-xs text-[var(--muted)] mt-1">
            Build hardware together. Private inventories stay private — BOMs share strictly allowlisted component snapshots. Max 6 members per team.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded font-bold text-xs uppercase tracking-wider bg-[var(--amber)] text-[#17120a] hover:bg-[#d97706] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Project
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 rounded bg-[var(--red)]/10 border border-[var(--red)] text-xs text-[var(--text)] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[var(--red)] shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Invitations Received Banner */}
      {pendingInvitations.length > 0 && (
        <div className="bg-[var(--panel)] border border-[var(--amber)] rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--amber)] flex items-center gap-2">
              <Users className="w-4 h-4" /> Team Invitations Waiting for You ({pendingInvitations.length})
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingInvitations.map((inv) => (
              <div key={inv.id} className="p-3 bg-[var(--panel2)] border border-[var(--line)] rounded flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[var(--text)]">{inv.project.name}</div>
                  <div className="text-[11px] text-[var(--muted)]">
                    Invited by <span className="font-semibold text-[var(--text)]">{inv.inviter.name}</span> as{' '}
                    <span className="font-mono text-[var(--amber)] font-bold">{inv.role}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRespondInvitation(inv.id, 'ACCEPT')}
                    className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" /> Accept
                  </button>
                  <button
                    onClick={() => handleRespondInvitation(inv.id, 'REJECT')}
                    className="flex items-center gap-1 px-2.5 py-1 bg-[var(--red)]/20 hover:bg-[var(--red)] text-[var(--red)] hover:text-white rounded text-xs font-semibold transition-colors"
                  >
                    <X className="w-3.5 h-3.5" /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projects List */}
      {loading ? (
        <div className="text-center py-16 font-mono text-xs text-[var(--muted)]">Loading collaborative workspaces...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 bg-[var(--panel)] border border-[var(--line)] rounded-lg p-8 space-y-3">
          <FolderKanban className="w-12 h-12 text-[var(--muted)] mx-auto opacity-40" />
          <h3 className="text-sm font-semibold text-[var(--text)]">No Projects Active</h3>
          <p className="text-xs text-[var(--muted)] max-w-sm mx-auto">
            Create a collaborative hardware project like &quot;Arc Reactor Core V2&quot; or &quot;Mark VII Repulsor Array&quot; to manage BOMs with your team.
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider bg-[var(--amber)] text-[#17120a] hover:bg-[#d97706] mt-2"
          >
            <Plus className="w-3.5 h-3.5" /> Create First Project
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {projects.map((proj) => {
            const isOwner = proj.currentUserRole === 'OWNER';
            const canEdit = isOwner || proj.currentUserRole === 'EDITOR';
            const memberCount = proj.members ? proj.members.length : 1;

            return (
              <div key={proj.id} className="bg-[var(--panel)] border border-[var(--line)] rounded-lg overflow-hidden space-y-4 p-5">
                {/* Project Header Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-base font-bold text-[var(--text)]">{proj.name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold bg-[var(--panel2)] border border-[var(--line)] text-[var(--amber)]">
                        {proj.status}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        MY ROLE: {proj.currentUserRole}
                      </span>
                    </div>
                    {proj.description && <p className="text-xs text-[var(--muted)]">{proj.description}</p>}
                  </div>

                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <button
                        onClick={() => {
                          setActiveProjectId(proj.id);
                          setIsAddBomOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider bg-[var(--amber)] text-[#17120a] hover:bg-[#d97706] transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add to BOM
                      </button>
                    )}

                    {canEdit && memberCount < 6 && (
                      <button
                        onClick={() => {
                          setActiveProjectId(proj.id);
                          setIsInviteOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-[var(--panel2)] border border-[var(--line)] text-[var(--text)] hover:border-[var(--amber)] transition-colors"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-[var(--amber)]" /> Invite Member
                      </button>
                    )}

                    {isOwner ? (
                      <button
                        onClick={() => handleDeleteProject(proj.id, proj.name)}
                        title="Delete project"
                        className="p-1.5 rounded text-[var(--muted)] hover:text-[var(--red)] hover:bg-[var(--red)]/10 border border-transparent hover:border-[var(--red)]/30 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleLeaveProject(proj.id, proj.ownerId)}
                        title="Leave project"
                        className="p-1.5 rounded text-[var(--muted)] hover:text-[var(--red)] hover:bg-[var(--red)]/10 border border-transparent hover:border-[var(--red)]/30 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Team Roster Bar (Max 6 limit enforced) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--panel2)] p-3 rounded border border-[var(--line)] text-xs">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[var(--amber)]" />
                    <span className="font-bold text-[var(--text)]">
                      Project Team ({memberCount} / 6 Members)
                    </span>
                    {memberCount >= 6 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--red)]/20 text-[var(--red)] font-semibold">
                        Full (Cap Reached)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {proj.members?.map((m) => (
                      <span
                        key={m.id}
                        className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--bg)] border border-[var(--line)] text-[11px]"
                      >
                        <span className="font-bold text-[var(--text)]">{m.user.name}</span>
                        <span className="text-[9px] font-mono px-1 rounded bg-[var(--panel2)] text-[var(--amber)] font-bold">
                          {m.role}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* BOM Snapshots Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--amber)] flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" /> Collaborative BOM Items ({proj.bomItems?.length || 0})
                    </span>
                    <span className="text-[10px] font-mono text-[var(--muted)] flex items-center gap-1">
                      <Lock className="w-3 h-3 text-emerald-400" /> Private costs &amp; stock hidden from teammates
                    </span>
                  </div>

                  {!proj.bomItems || proj.bomItems.length === 0 ? (
                    <div className="p-4 bg-[var(--panel2)] border border-dashed border-[var(--line)] rounded text-center text-xs text-[var(--muted)]">
                      No components added to this BOM yet. {canEdit ? 'Click "Add to BOM" above to share a snapshot from your inventory or add a planned part.' : ''}
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-[var(--line)] rounded">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[var(--panel2)] text-[10px] uppercase font-mono text-[var(--muted)] border-b border-[var(--line)]">
                          <tr>
                            <th className="py-2.5 px-3">Component / Part</th>
                            <th className="py-2.5 px-3">MPN / Model</th>
                            <th className="py-2.5 px-3">Category</th>
                            <th className="py-2.5 px-3 text-right">Required Qty</th>
                            <th className="py-2.5 px-3">Shared By</th>
                            <th className="py-2.5 px-3">Notes</th>
                            {canEdit && <th className="py-2.5 px-3 text-right">Actions</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--line)]">
                          {proj.bomItems.map((item) => (
                            <tr key={item.id} className="hover:bg-[var(--panel2)]/50 transition-colors">
                              <td className="py-2.5 px-3 font-semibold text-[var(--text)]">
                                {item.name}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[var(--muted)]">
                                {item.mpn || item.model || '—'}
                              </td>
                              <td className="py-2.5 px-3 text-[var(--muted)]">
                                {item.category || 'General'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-[var(--amber)]">
                                {item.quantityRequired} {item.unit}
                              </td>
                              <td className="py-2.5 px-3 text-[var(--muted)]">
                                {item.createdBy?.name || 'User'}
                              </td>
                              <td className="py-2.5 px-3 text-[var(--muted)] max-w-xs truncate">
                                {item.notes || '—'}
                              </td>
                              {canEdit && (
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    onClick={() => handleDeleteBomItem(proj.id, item.id, item.name)}
                                    title="Remove from BOM"
                                    className="p-1 rounded text-[var(--muted)] hover:text-[var(--red)] transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Create Project */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Hardware Project">
        <form onSubmit={handleCreateProject} className="space-y-4 text-xs">
          <div>
            <label className="block text-[10px] uppercase font-semibold text-[var(--muted)] mb-1">
              Project Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Arc Reactor Core V2"
              value={projectForm.name}
              onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-semibold text-[var(--muted)] mb-1">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="Project purpose, specifications, hardware build targets..."
              value={projectForm.description}
              onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-semibold text-[var(--muted)] mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={projectForm.startDate}
                onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] font-mono focus:border-[var(--amber)] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-semibold text-[var(--muted)] mb-1">
                Target Date
              </label>
              <input
                type="date"
                value={projectForm.targetDate}
                onChange={(e) => setProjectForm({ ...projectForm, targetDate: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] font-mono focus:border-[var(--amber)] focus:outline-hidden"
              />
            </div>
          </div>

          <div className="p-3 bg-[var(--panel2)] border border-[var(--line)] rounded text-[11px] text-[var(--muted)] flex items-start gap-2">
            <Info className="w-4 h-4 text-[var(--amber)] shrink-0 mt-0.5" />
            <span>As creator, you will be the Project Owner. You can invite up to 5 accepted friends to collaborate.</span>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 rounded bg-[var(--panel2)] text-[var(--muted)] hover:text-[var(--text)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-[var(--amber)] text-[#17120a] font-bold uppercase tracking-wider hover:bg-[#d97706]"
            >
              Create Project
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Invite Friend */}
      <Modal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} title="Invite Team Member (Max 6 Total)">
        <form onSubmit={handleSendInvite} className="space-y-4 text-xs">
          <div>
            <label className="block text-[10px] uppercase font-semibold text-[var(--muted)] mb-1">
              Select Friend / Teammate *
            </label>
            {friends.length === 0 ? (
              <p className="text-xs text-[var(--muted)] p-2 bg-[var(--bg)] border border-[var(--line)] rounded">
                No accepted friends found. Add friends in the Friends page first.
              </p>
            ) : (
              <select
                required
                value={inviteForm.targetUserId}
                onChange={(e) => setInviteForm({ ...inviteForm, targetUserId: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] focus:outline-hidden"
              >
                <option value="">-- Choose a friend or teammate --</option>
                {friends.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} (@{f.username})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-[10px] uppercase font-semibold text-[var(--muted)] mb-1">
              Assigned Role *
            </label>
            <select
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as any })}
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] focus:outline-hidden font-mono"
            >
              <option value="VIEWER">VIEWER (Read-only access to BOM and team roster)</option>
              <option value="EDITOR">EDITOR (Can add/edit/remove BOM items and invite friends)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
            <button
              type="button"
              onClick={() => setIsInviteOpen(false)}
              className="px-4 py-2 rounded bg-[var(--panel2)] text-[var(--muted)] hover:text-[var(--text)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!inviteForm.targetUserId}
              className="px-4 py-2 rounded bg-[var(--amber)] text-[#17120a] font-bold uppercase tracking-wider hover:bg-[#d97706] disabled:opacity-50"
            >
              Send Invitation
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Add BOM Item */}
      <Modal isOpen={isAddBomOpen} onClose={() => setIsAddBomOpen(false)} title="Add Component to Project BOM">
        <div className="space-y-4 text-xs">
          {/* Tab selector */}
          <div className="flex border-b border-[var(--line)]">
            <button
              type="button"
              onClick={() => setBomMode('inventory')}
              className={`pb-2 px-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                bomMode === 'inventory'
                  ? 'border-[var(--amber)] text-[var(--amber)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              Snapshot from My Inventory
            </button>
            <button
              type="button"
              onClick={() => setBomMode('custom')}
              className={`pb-2 px-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                bomMode === 'custom'
                  ? 'border-[var(--amber)] text-[var(--amber)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              Custom / Planned Part
            </button>
          </div>

          <form onSubmit={handleAddBomItem} className="space-y-4">
            {bomMode === 'inventory' ? (
              <>
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-[var(--muted)] mb-1">
                    Select from Your Private Inventory *
                  </label>
                  <select
                    required
                    value={bomForm.sourceComponentId}
                    onChange={(e) => setBomForm({ ...bomForm, sourceComponentId: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] focus:outline-hidden"
                  >
                    <option value="">-- Choose a private component --</option>
                    {myComponents.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.mpn ? `(${c.mpn})` : ''} - {c.category || 'General'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-[var(--panel2)] border border-[var(--line)] rounded text-[11px] text-[var(--muted)] space-y-1">
                  <div className="font-bold text-[var(--amber)] flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" /> Privacy Guarantee
                  </div>
                  <p>
                    Only technical specs, name, and MPN are copied to the team BOM. Your personal stock counts, purchase costs, storage bin, and supplier remain 100% private.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-[var(--muted)] mb-1">
                      Part Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ATmega328P-PU"
                      value={bomForm.name}
                      onChange={(e) => setBomForm({ ...bomForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-[var(--muted)] mb-1">
                      Manufacturer / Brand
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Microchip"
                      value={bomForm.manufacturer}
                      onChange={(e) => setBomForm({ ...bomForm, manufacturer: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-[var(--muted)] mb-1">
                      MPN / Part Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ATMEGA328P-PU"
                      value={bomForm.mpn}
                      onChange={(e) => setBomForm({ ...bomForm, mpn: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] font-mono focus:border-[var(--amber)] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-[var(--muted)] mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Microcontroller"
                      value={bomForm.category}
                      onChange={(e) => setBomForm({ ...bomForm, category: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] focus:outline-hidden"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-semibold text-[var(--muted)] mb-1">
                  Quantity Required *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={bomForm.quantityRequired}
                  onChange={(e) => setBomForm({ ...bomForm, quantityRequired: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] font-mono focus:border-[var(--amber)] focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-semibold text-[var(--muted)] mb-1">
                  Unit of Measure
                </label>
                <input
                  type="text"
                  value={bomForm.unit}
                  onChange={(e) => setBomForm({ ...bomForm, unit: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-semibold text-[var(--muted)] mb-1">
                Collaborative Team Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Pin 4 needs pullup resistor, or test with 3.3V first"
                value={bomForm.notes}
                onChange={(e) => setBomForm({ ...bomForm, notes: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] focus:outline-hidden"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setIsAddBomOpen(false)}
                className="px-4 py-2 rounded bg-[var(--panel2)] text-[var(--muted)] hover:text-[var(--text)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded bg-[var(--amber)] text-[#17120a] font-bold uppercase tracking-wider hover:bg-[#d97706]"
              >
                Add to BOM
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
