"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  createProject,
  updateProject,
  deleteProject,
  type ProjectWithManager,
  type ProjectManagerOption,
  type ProjectStatus,
} from "@/lib/queries/projects";
import { StatusBadge } from "./StatusBadge";
import { ProjectFormModal } from "./ProjectFormModal";
import { DeleteDialog } from "./DeleteDialog";
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Calendar,
  UserCheck,
  FolderKanban,
  Edit2,
  Trash2,
  ExternalLink,
} from "lucide-react";
import type { UserRole } from "@/types/database";

interface ProjectsViewProps {
  initialProjects: ProjectWithManager[];
  managers: ProjectManagerOption[];
  userRole: UserRole;
}

export function ProjectsView({
  initialProjects,
  managers,
  userRole,
}: ProjectsViewProps) {
  const router = useRouter();
  const supabase = createClient();

  const [projects, setProjects] = useState<ProjectWithManager[]>(initialProjects);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "status" | "name">("date");

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithManager | null>(null);
  const [deletingProject, setDeletingProject] = useState<ProjectWithManager | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const canManage = userRole === "admin" || userRole === "project_manager";

  // Filtering & Sorting
  const filteredProjects = projects
    .filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(search.toLowerCase())) ||
        (p.manager_name && p.manager_name.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus = filterStatus === "all" || p.status === filterStatus;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "status") return a.status.localeCompare(b.status);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Handlers
  const handleStatusChange = async (projectId: string, newStatus: ProjectStatus) => {
    const { error } = await updateProject(supabase, projectId, { status: newStatus });
    if (!error) {
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, status: newStatus } : p))
      );
      router.refresh();
    }
  };

  const handleFormSubmit = async (formData: {
    name: string;
    description: string;
    status: ProjectStatus;
    start_date: string;
    end_date: string;
    manager_id: string;
  }) => {
    setIsSubmitting(true);
    try {
      if (editingProject) {
        const { data, error } = await updateProject(supabase, editingProject.id, {
          name: formData.name,
          description: formData.description || null,
          status: formData.status,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          manager_id: formData.manager_id || null,
        });

        if (error) throw error;

        setProjects((prev) =>
          prev.map((p) =>
            p.id === editingProject.id
              ? {
                  ...p,
                  ...formData,
                  manager_name:
                    managers.find((m) => m.id === formData.manager_id)?.full_name || null,
                }
              : p
          )
        );
      } else {
        const { data, error } = await createProject(supabase, {
          name: formData.name,
          description: formData.description || undefined,
          status: formData.status,
          start_date: formData.start_date || undefined,
          end_date: formData.end_date || undefined,
          manager_id: formData.manager_id || undefined,
        });

        if (error) throw error;
        if (data) {
          const newProj: ProjectWithManager = {
            ...data,
            manager_name:
              managers.find((m) => m.id === formData.manager_id)?.full_name || null,
          };
          setProjects((prev) => [newProj, ...prev]);
        }
      }
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProject) return;
    setIsDeleting(true);
    try {
      const { error } = await deleteProject(supabase, deletingProject.id);
      if (!error) {
        setProjects((prev) => prev.filter((p) => p.id !== deletingProject.id));
        setDeletingProject(null);
        router.refresh();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects by name, manager..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Status filter */}
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-lg text-xs font-medium text-foreground">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-card border border-border px-3 py-2 rounded-lg text-xs font-medium text-foreground focus:outline-none cursor-pointer"
          >
            <option value="date">Sort: Latest</option>
            <option value="name">Sort: Name</option>
            <option value="status">Sort: Status</option>
          </select>

          {/* Create project button */}
          {canManage && (
            <button
              type="button"
              onClick={() => {
                setEditingProject(null);
                setIsFormOpen(true);
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          )}
        </div>
      </div>

      {/* Grid of project cards */}
      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl bg-card/50">
          <FolderKanban className="w-12 h-12 text-muted-foreground mb-3 opacity-40" />
          <h3 className="text-base font-semibold text-foreground">No projects found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {search || filterStatus !== "all"
              ? "Try adjusting your search query or status filters."
              : "Get started by creating your first construction project."}
          </p>
          {canManage && !search && filterStatus === "all" && (
            <button
              type="button"
              onClick={() => {
                setEditingProject(null);
                setIsFormOpen(true);
              }}
              className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create First Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="bg-card border border-border rounded-xl p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between relative group"
            >
              <div>
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <StatusBadge
                    status={project.status}
                    canEdit={canManage}
                    onStatusChange={(newStatus) => handleStatusChange(project.id, newStatus)}
                  />

                  {/* Actions dropdown button */}
                  {canManage && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveMenuId((prev) => (prev === project.id ? null : project.id))
                        }
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeMenuId === project.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setActiveMenuId(null)}
                          />
                          <div className="absolute right-0 mt-1 w-32 rounded-lg bg-card border border-border shadow-lg py-1 z-20 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                setEditingProject(project);
                                setIsFormOpen(true);
                              }}
                              className="w-full text-left px-3 py-1.5 font-medium text-foreground hover:bg-muted flex items-center gap-2"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-indigo-500" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                setDeletingProject(project);
                              }}
                              className="w-full text-left px-3 py-1.5 font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Project title */}
                <Link
                  href={`/projects/${project.id}`}
                  className="font-bold text-foreground text-lg hover:text-primary transition-colors flex items-center gap-1.5 group-hover:translate-x-0.5"
                >
                  <span className="truncate">{project.name}</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-primary" />
                </Link>

                {/* Description */}
                {project.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                    {project.description}
                  </p>
                )}
              </div>

              {/* Footer info */}
              <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="truncate font-medium text-foreground/80">
                    {project.manager_name || "Unassigned"}
                  </span>
                </div>

                {project.end_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{project.end_date}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      <ProjectFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
        initialData={editingProject}
        managers={managers}
        isSubmitting={isSubmitting}
      />

      {/* Delete dialog */}
      <DeleteDialog
        isOpen={!!deletingProject}
        projectName={deletingProject?.name || ""}
        onClose={() => setDeletingProject(null)}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
    </div>
  );
}
