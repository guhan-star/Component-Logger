'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  Boxes,
  Trash2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';

interface Project {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  startDate?: string | null;
  targetDate?: string | null;
  notes?: string | null;
  components: Array<{
    id: string;
    plannedQuantity: number;
    reservedQuantity: number;
    usedQuantity: number;
    notes?: string | null;
    component: {
      id: string;
      name: string;
      quantityAvailable: number;
      unitOfMeasurement: string;
    };
  }>;
}

interface ComponentOption {
  id: string;
  name: string;
  quantityAvailable: number;
  unitOfMeasurement: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [components, setComponents] = useState<ComponentOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAddBomOpen, setIsAddBomOpen] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Forms
  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    status: 'Active',
    startDate: new Date().toISOString().split('T')[0],
    targetDate: '',
    notes: '',
  });

  const [bomForm, setBomForm] = useState({
    componentId: '',
    plannedQuantity: 1,
    reservedQuantity: 1,
    usedQuantity: 0,
    notes: '',
  });

  const loadProjects = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/projects').then((res) => res.json()),
      fetch('/api/components?pageSize=100').then((res) => res.json()),
    ])
      .then(([projRes, compRes]) => {
        setProjects(projRes.data || []);
        setComponents(
          (compRes.data || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            quantityAvailable: c.quantityAvailable,
            unitOfMeasurement: c.unitOfMeasurement,
          }))
        );
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectForm),
      });
      if (res.ok) {
        setIsCreateOpen(false);
        setProjectForm({
          name: '',
          description: '',
          status: 'Active',
          startDate: new Date().toISOString().split('T')[0],
          targetDate: '',
          notes: '',
        });
        loadProjects();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create project');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddBomItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectId) return;

    try {
      const res = await fetch(`/api/projects/${activeProjectId}/components`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bomForm,
          plannedQuantity: Number(bomForm.plannedQuantity),
          reservedQuantity: Number(bomForm.reservedQuantity),
          usedQuantity: Number(bomForm.usedQuantity),
        }),
      });

      if (res.ok) {
        setIsAddBomOpen(false);
        setBomForm({
          componentId: '',
          plannedQuantity: 1,
          reservedQuantity: 1,
          usedQuantity: 0,
          notes: '',
        });
        loadProjects();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to reserve BOM component');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveBomItem = async (projectId: string, componentId: string) => {
    if (!confirm('Remove this component from the project and release its reservation?')) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/components?componentId=${componentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        loadProjects();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (!confirm(`Delete project "${name}"?`)) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadProjects();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-primary" />
            Projects & Bill of Materials (BOM)
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organize hardware builds, reserve stock, and track parts consumption across active projects.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Create Project
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading projects...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl p-8 space-y-3">
          <FolderKanban className="w-12 h-12 text-muted-foreground/40 mx-auto" />
          <h3 className="text-base font-semibold text-foreground">No projects yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Create a project like &quot;Solar Weather Station&quot; or &quot;Quadrotor Flight Controller&quot; to begin tracking BOMs.
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 mt-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Create First Project
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {projects.map((proj) => (
            <Card key={proj.id} className="overflow-hidden">
              <CardHeader className="bg-muted/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={
                          proj.status === 'Active'
                            ? 'success'
                            : proj.status === 'Planning'
                            ? 'primary'
                            : proj.status === 'Completed'
                            ? 'secondary'
                            : 'warning'
                        }
                      >
                        {proj.status}
                      </Badge>
                      <h3 className="text-lg font-bold text-foreground">{proj.name}</h3>
                    </div>
                    {proj.description && (
                      <p className="text-xs text-muted-foreground">{proj.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setActiveProjectId(proj.id);
                        setIsAddBomOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add BOM Item
                    </button>
                    <button
                      onClick={() => handleDeleteProject(proj.id, proj.name)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                  {proj.startDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Started: {new Date(proj.startDate).toLocaleDateString()}
                    </span>
                  )}
                  {proj.targetDate && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Target: {new Date(proj.targetDate).toLocaleDateString()}
                    </span>
                  )}
                  <span>{proj.components.length} components assigned</span>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {proj.components.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No components linked to this bill of materials. Click &quot;Add BOM Item&quot; to reserve parts.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/40 border-b border-border font-semibold text-muted-foreground uppercase text-[11px]">
                        <tr>
                          <th className="py-2.5 px-4">Component</th>
                          <th className="py-2.5 px-4">Planned Qty</th>
                          <th className="py-2.5 px-4">Reserved Stock</th>
                          <th className="py-2.5 px-4">Used Qty</th>
                          <th className="py-2.5 px-4">Role / Notes</th>
                          <th className="py-2.5 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {proj.components.map((pc) => (
                          <tr key={pc.id} className="hover:bg-muted/20">
                            <td className="py-2.5 px-4 font-semibold text-foreground">
                              <Link href={`/components/${pc.component.id}`} className="hover:text-primary">
                                {pc.component.name}
                              </Link>
                              <span className="text-[11px] text-muted-foreground block">
                                ({pc.component.quantityAvailable} currently available in stock)
                              </span>
                            </td>
                            <td className="py-2.5 px-4 font-medium">{pc.plannedQuantity} {pc.component.unitOfMeasurement}</td>
                            <td className="py-2.5 px-4">
                              <span className="font-bold text-blue-500">{pc.reservedQuantity} {pc.component.unitOfMeasurement}</span>
                            </td>
                            <td className="py-2.5 px-4 font-medium">{pc.usedQuantity}</td>
                            <td className="py-2.5 px-4 text-muted-foreground">{pc.notes || '—'}</td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                onClick={() => handleRemoveBomItem(proj.id, pc.component.id)}
                                className="text-muted-foreground hover:text-rose-500 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* CREATE PROJECT MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Hardware Project"
        description="Track electronics builds, prototypes, and bill of materials."
      >
        <form onSubmit={handleCreateProject} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-foreground mb-1">Project Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Autonomous Ground Vehicle (AGV)"
              value={projectForm.name}
              onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            />
          </div>

          <div>
            <label className="block font-medium text-foreground mb-1">Status</label>
            <select
              value={projectForm.status}
              onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            >
              <option value="Planning">Planning</option>
              <option value="Active">Active</option>
              <option value="On Hold">On Hold</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-foreground mb-1">Start Date</label>
              <input
                type="date"
                value={projectForm.startDate}
                onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
              />
            </div>
            <div>
              <label className="block font-medium text-foreground mb-1">Target Date</label>
              <input
                type="date"
                value={projectForm.targetDate}
                onChange={(e) => setProjectForm({ ...projectForm, targetDate: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-foreground mb-1">Description / Goal</label>
            <textarea
              rows={2}
              placeholder="Objectives, microcontroller architecture, wiring notes..."
              value={projectForm.description}
              onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 border border-border rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90"
            >
              Create Project
            </button>
          </div>
        </form>
      </Modal>

      {/* ADD BOM ITEM MODAL */}
      <Modal
        isOpen={isAddBomOpen}
        onClose={() => setIsAddBomOpen(false)}
        title="Add BOM Component to Project"
        description="Allocate or reserve parts from available warehouse inventory."
      >
        <form onSubmit={handleAddBomItem} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-foreground mb-1">Component *</label>
            <select
              required
              value={bomForm.componentId}
              onChange={(e) => setBomForm({ ...bomForm, componentId: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            >
              <option value="">Select Component</option>
              {components.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.quantityAvailable} {c.unitOfMeasurement} available)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-foreground mb-1">Planned Quantity *</label>
              <input
                type="number"
                min="1"
                required
                value={bomForm.plannedQuantity}
                onChange={(e) => setBomForm({ ...bomForm, plannedQuantity: parseInt(e.target.value, 10) || 1 })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
              />
            </div>
            <div>
              <label className="block font-medium text-foreground mb-1">Reserve From Stock Now</label>
              <input
                type="number"
                min="0"
                value={bomForm.reservedQuantity}
                onChange={(e) => setBomForm({ ...bomForm, reservedQuantity: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-foreground mb-1">Notes / Function in Circuit</label>
            <input
              type="text"
              placeholder="e.g. Master I2C bus pull-up, voltage regulator"
              value={bomForm.notes}
              onChange={(e) => setBomForm({ ...bomForm, notes: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setIsAddBomOpen(false)}
              className="px-4 py-2 border border-border rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90"
            >
              Reserve & Add to BOM
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
