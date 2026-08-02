"use client";

import { useState, useEffect } from "react";
import { X, Loader2, MapPin } from "lucide-react";
import type { ProjectWithManager, ProjectManagerOption, ClientOption, ProjectStatus } from "@/lib/queries/projects";

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: {
    name: string;
    description: string;
    status: ProjectStatus;
    start_date: string;
    end_date: string;
    manager_id: string;
    client_id: string;
    budget_allocated?: number | null;
    site_latitude?: number | null;
    site_longitude?: number | null;
    geofence_radius_meters?: number | null;
  }) => Promise<void>;
  initialData?: ProjectWithManager | null;
  managers: ProjectManagerOption[];
  clients?: ClientOption[];
  isSubmitting?: boolean;
}

export function ProjectFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  managers,
  clients = [],
  isSubmitting = false,
}: ProjectFormModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [managerId, setManagerId] = useState("");
  const [clientId, setClientId] = useState("");
  const [budgetAllocated, setBudgetAllocated] = useState("");
  const [siteLatitude, setSiteLatitude] = useState("");
  const [siteLongitude, setSiteLongitude] = useState("");
  const [geofenceRadiusMeters, setGeofenceRadiusMeters] = useState("250");
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setDescription(initialData.description || "");
      setStatus(initialData.status || "planning");
      setStartDate(initialData.start_date || "");
      setEndDate(initialData.end_date || "");
      setManagerId(initialData.manager_id || "");
      setClientId(initialData.client_id || "");
      setBudgetAllocated(initialData.budget_allocated ? String(initialData.budget_allocated) : "");
      setSiteLatitude(initialData.site_latitude !== null && initialData.site_latitude !== undefined ? String(initialData.site_latitude) : "");
      setSiteLongitude(initialData.site_longitude !== null && initialData.site_longitude !== undefined ? String(initialData.site_longitude) : "");
      setGeofenceRadiusMeters(initialData.geofence_radius_meters ? String(initialData.geofence_radius_meters) : "250");
    } else {
      setName("");
      setDescription("");
      setStatus("planning");
      setStartDate("");
      setEndDate("");
      setManagerId("");
      setClientId("");
      setBudgetAllocated("");
      setSiteLatitude("");
      setSiteLongitude("");
      setGeofenceRadiusMeters("250");
    }
    setError("");
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        status,
        start_date: startDate,
        end_date: endDate,
        manager_id: managerId,
        client_id: clientId,
        budget_allocated: budgetAllocated ? parseFloat(budgetAllocated) : null,
        site_latitude: siteLatitude ? parseFloat(siteLatitude) : null,
        site_longitude: siteLongitude ? parseFloat(siteLongitude) : null,
        geofence_radius_meters: geofenceRadiusMeters ? parseInt(geofenceRadiusMeters, 10) : 250,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save project");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30 shrink-0">
          <h3 className="font-semibold text-foreground text-base">
            {initialData ? "Edit Project Details" : "Create New Project"}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Project Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sunrise Residency Core Tower"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief overview of project scope..."
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Initial Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="w-full px-2.5 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary capitalize"
              >
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Assigned PM
              </label>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="w-full px-2.5 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Unassigned</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name || m.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Assigned Client
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-2.5 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">No Client Linked</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name || c.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Completion Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Allocated Budget (₹)
              </label>
              <input
                type="number"
                min={0}
                step={10000}
                value={budgetAllocated}
                onChange={(e) => setBudgetAllocated(e.target.value)}
                placeholder="e.g. 25000000"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* GPS Geofence Configuration Section */}
          <div className="p-4 rounded-xl bg-secondary/40 border border-border space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <MapPin className="w-4 h-4 text-rose-500" />
              Site GPS Coordinates & Geofence Radius
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={siteLatitude}
                  onChange={(e) => setSiteLatitude(e.target.value)}
                  placeholder="e.g. 19.0760"
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={siteLongitude}
                  onChange={(e) => setSiteLongitude(e.target.value)}
                  placeholder="e.g. 72.8777"
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  Geofence Radius (meters)
                </label>
                <input
                  type="number"
                  min={50}
                  step={10}
                  value={geofenceRadiusMeters}
                  onChange={(e) => setGeofenceRadiusMeters(e.target.value)}
                  placeholder="250"
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500 font-bold"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Check-ins beyond this radius trigger a soft warning confirmation to the site worker and are flagged in the attendance audit log.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all shadow-sm disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {initialData ? "Save Changes" : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
