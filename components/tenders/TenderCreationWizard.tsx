"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createTender } from "@/lib/queries/tenders";
import type { TenderStatus } from "@/types/database";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  FileText,
  Building2,
  Calendar,
  IndianRupee,
  Upload,
  AlertTriangle,
  Loader2,
  Wand2,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectOption {
  id: string;
  name: string;
}

interface TenderCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectOption[];
  userId: string;
}

const CATEGORIES = [
  { value: "civil", label: "Civil & Structural Concrete" },
  { value: "electrical", label: "Electrical & Power Systems" },
  { value: "mechanical", label: "HVAC & Mechanical Systems" },
  { value: "interior", label: "Interior Fit-Out & Joinery" },
  { value: "plumbing", label: "Plumbing & Firefighting" },
  { value: "structural_steel", label: "Structural Steelwork" },
  { value: "landscaping", label: "Landscaping & External Works" },
  { value: "other", label: "Other General Subcontract" },
];

const SCOPE_TEMPLATES: Record<string, string> = {
  civil: `### 1. Scope of Work
- Excavation, earthwork, and foundation laying as per structural engineering drawings.
- RCC structural framing (M25 grade minimum) including column, beam, and slab casting.
- Masonry work using AAC blocks and double-coat external cement plastering.

### 2. Material Specifications
- Cement: OPC 53 Grade (UltraTech / ACC / Ambuja equivalent).
- TMT Steel Bars: Fe500D Thermo-Mechanically Treated bars.

### 3. Exclusions & Demarcation
- External municipal water & sewer connections beyond 5m site perimeter.
- MEP internal conduit and wiring.`,

  electrical: `### 1. Scope of Work
- Supply, installation, and testing of HT/LT distribution panels and sub-distribution boards.
- Main feeder cabling, conduit laying, and wire pulling across all floors.
- Earthing pits, lightning protection grid, and emergency backup generator cabling.

### 2. Material Specifications
- Cables & Wires: FRLS Copper Conductor (Polycab / Havells / Finolex).
- Switchgear: Schneider / ABB / Siemens MCBs & MCCBs.

### 3. Testing & Handover
- Insulation resistance test, earth pit resistance testing (<1 ohm), and full load testing.`,

  mechanical: `### 1. Scope of Work
- Supply, fabrication, and erection of GI ducting with thermal insulation.
- Installation of Chilled Water Piping, Air Handling Units (AHUs), and Fan Coil Units (FCUs).
- Mechanical ventilation for basement parking and smoke extraction systems.

### 2. Testing & Handover
- Hydrostatic pressure testing of piping at 1.5x working pressure for 24 hours.
- Air balancing report & CFM validation for all zones.`,

  interior: `### 1. Scope of Work
- Gypsum board false ceiling installation with perimeter cove light channels.
- Modular acoustic wall paneling and toughened glass partition systems.
- Supply and installation of BWR grade plywood joinery with 1.0mm premium laminate finish.
- Polyurethane (PU) paint finish on exposed timber and low-VOC emulsion paint on walls.

### 2. Exclusions
- MEP final fixture terminations (handled by respective MEP contractors).`,

  plumbing: `### 1. Scope of Work
- Internal CPVC cold/hot water supply lines and SWR drainage stack piping.
- Installation of sanitary fixtures, CP fittings, and rainwater harvesting connections.
- Fire sprinkler main network, hose reel cabinets, and landing valves.

### 2. Testing
- Water tightness test for drainage lines & 10 bar hydraulic test for supply lines.`,

  structural_steel: `### 1. Scope of Work
- Fabrication, shop-priming, and erection of structural steel sections (ISMB/ISMC).
- High-strength friction grip (HSFG) bolting and full-penetration butt welding.
- Application of intumescent fire-proof paint (2-hour fire rating).`,

  landscaping: `### 1. Scope of Work
- Site grading, topsoil enrichment, and softscape lawn/plant installation.
- Interlocking paver block installation for pedestrian walkways and driveway perimeters.
- Automated drip irrigation network and outdoor landscape lighting.`,

  other: `### 1. Scope of Work
- Detailed description of trade deliverables and milestones.
- Material quality standards and testing requirements.
- Exclusions and site boundary limits.`,
};

const ELIGIBILITY_TEMPLATES: Record<string, string> = {
  civil: `- Minimum 5 years of active experience in commercial/residential civil construction.
- Successfully executed at least 2 projects of value > ₹50 Lakhs in the last 3 years.
- Valid GST registration and EPF/ESI compliance certificate.
- Availability of core site machinery (concrete mixers, needle vibrators, scaffolding).`,

  electrical: `- Class A Electrical Contractor License issued by the State Licensing Board.
- Minimum 3 years experience in commercial electrical installations.
- Turn-over of at least ₹30 Lakhs per annum for the last 2 financial years.
- Dedicated Licensed Electrical Supervisor on site.`,

  interior: `- Proven track record in corporate office or hospitality interior fit-outs.
- Portfolio of at least 3 completed projects with verifiable client completion certificates.
- Skilled carpenter & painter workforce available for immediate deployment.`,

  default: `- Minimum 3 years of trade experience in similar scope.
- Valid GST registration, PAN, and active bank account.
- Satisfactory safety track record with zero major lost-time incidents in past 12 months.`,
};

export function TenderCreationWizard({
  isOpen,
  onClose,
  projects,
  userId,
}: TenderCreationWizardProps) {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("civil");
  const [projectId, setProjectId] = useState<string>("");
  const [scopeDescription, setScopeDescription] = useState("");
  const [eligibilityCriteria, setEligibilityCriteria] = useState("");
  const [estimatedValueMin, setEstimatedValueMin] = useState<string>("");
  const [estimatedValueMax, setEstimatedValueMax] = useState<string>("");

  // Default deadline: 10 days from now
  const defaultDeadline = new Date(Date.now() + 10 * 86400000)
    .toISOString()
    .slice(0, 16);
  const [submissionDeadline, setSubmissionDeadline] = useState(defaultDeadline);

  // Files
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handler to apply category template
  const handleApplyCategoryTemplate = () => {
    const template = SCOPE_TEMPLATES[category] || SCOPE_TEMPLATES.other;
    setScopeDescription(template);

    const eligTemplate = ELIGIBILITY_TEMPLATES[category] || ELIGIBILITY_TEMPLATES.default;
    if (!eligibilityCriteria) {
      setEligibilityCriteria(eligTemplate);
    }
  };

  // Soft deadline validation
  const deadlineDate = new Date(submissionDeadline);
  const minValidDeadline = new Date(Date.now() + 3 * 86400000);
  const isDeadlineTooShort = deadlineDate < minValidDeadline;

  // Final Submit
  const handleSubmitTender = async (targetStatus: TenderStatus) => {
    setIsSubmitting(true);
    setErrorMsg(null);

    const minVal = estimatedValueMin ? parseFloat(estimatedValueMin) : null;
    const maxVal = estimatedValueMax ? parseFloat(estimatedValueMax) : null;

    const { data: newTender, error: createErr } = await createTender(
      supabase,
      {
        title,
        category,
        project_id: projectId || null,
        scope_description: scopeDescription,
        eligibility_criteria: eligibilityCriteria,
        estimated_value_min: minVal,
        estimated_value_max: maxVal,
        submission_deadline: new Date(submissionDeadline).toISOString(),
        status: targetStatus,
      },
      userId
    );

    if (createErr || !newTender) {
      setErrorMsg(createErr?.message || "Failed to create tender.");
      setIsSubmitting(false);
      return;
    }

    // Upload files if selected
    if (selectedFiles.length > 0) {
      for (const file of selectedFiles) {
        const fileExt = file.name.split(".").pop();
        const filePath = `${newTender.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadErr } = await supabase.storage
          .from("tender-documents")
          .upload(filePath, file);

        if (!uploadErr) {
          await (supabase.from("tender_documents") as any).insert({
            tender_id: newTender.id,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type || "application/octet-stream",
            file_size: file.size,
            uploaded_by: userId,
          });
        }
      }
    }

    setIsSubmitting(false);
    onClose();
    router.refresh();
  };

  const STEPS = [
    { num: 1, label: "Basics" },
    { num: 2, label: "Scope & Template" },
    { num: 3, label: "Eligibility & Budget" },
    { num: 4, label: "Documents" },
    { num: 5, label: "Review & Publish" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div>
            <h3 className="text-lg font-bold text-foreground">Create New Tender</h3>
            <p className="text-xs text-muted-foreground">
              Guide contractor bidding by setting clear scope, eligibility, and deadline specs.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="px-6 py-3 border-b border-border bg-card flex items-center justify-between overflow-x-auto">
          {STEPS.map((s) => {
            const isActive = step === s.num;
            const isDone = step > s.num;
            return (
              <div key={s.num} className="flex items-center gap-2 shrink-0">
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                    isDone
                      ? "bg-emerald-500 text-white"
                      : isActive
                      ? "bg-indigo-600 text-white ring-4 ring-indigo-500/20"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isDone ? <Check className="w-4 h-4" /> : s.num}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium hidden sm:inline",
                    isActive ? "text-foreground font-semibold" : "text-muted-foreground"
                  )}
                >
                  {s.label}
                </span>
                {s.num < 5 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 mx-1 hidden sm:inline" />}
              </div>
            );
          })}
        </div>

        {/* Body Content per Step */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: BASICS */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Tender Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Guardrail & Safety Barrier Installation — NH-48"
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Trade Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Linked Project (Optional)
                  </label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Standalone Tender (No Project Link) --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 flex gap-3 text-xs text-indigo-900 dark:text-indigo-200">
                <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Trade Category Scaffolding</p>
                  <p className="mt-0.5 text-muted-foreground">
                    Selecting a trade category automatically prepares tailored scope and eligibility boilerplate templates in the next step to save setup time.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: SCOPE & TEMPLATES */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground block">
                  Detailed Scope of Work
                </label>
                <button
                  type="button"
                  onClick={handleApplyCategoryTemplate}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  Apply {CATEGORIES.find((c) => c.value === category)?.label} Scaffolding Template
                </button>
              </div>

              <textarea
                rows={10}
                value={scopeDescription}
                onChange={(e) => setScopeDescription(e.target.value)}
                placeholder="Enter scope details, material standards, work breakdown, and exclusions..."
                className="w-full p-3.5 bg-background border border-border rounded-xl text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
              />
            </div>
          )}

          {/* STEP 3: ELIGIBILITY & BUDGET */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Contractor Eligibility Criteria
                </label>
                <textarea
                  rows={4}
                  value={eligibilityCriteria}
                  onChange={(e) => setEligibilityCriteria(e.target.value)}
                  placeholder="Specify required experience years, licenses, turn-over minimums, etc."
                  className="w-full p-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Estimated Minimum Budget (₹)
                  </label>
                  <div className="relative">
                    <IndianRupee className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="number"
                      value={estimatedValueMin}
                      onChange={(e) => setEstimatedValueMin(e.target.value)}
                      placeholder="e.g. 1500000"
                      className="w-full pl-9 pr-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Estimated Maximum Budget (₹)
                  </label>
                  <div className="relative">
                    <IndianRupee className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="number"
                      value={estimatedValueMax}
                      onChange={(e) => setEstimatedValueMax(e.target.value)}
                      placeholder="e.g. 2000000"
                      className="w-full pl-9 pr-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Submission Deadline *
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="datetime-local"
                    value={submissionDeadline}
                    onChange={(e) => setSubmissionDeadline(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                {isDeadlineTooShort && (
                  <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Warning: Recommended bidding window is at least 3 days from today.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: DOCUMENTS */}
          {step === 4 && (
            <div className="space-y-4">
              <label className="text-xs font-semibold text-foreground block">
                Attach Supporting Tender Drawings & Specifications
              </label>

              <div className="border-2 border-dashed border-border rounded-2xl p-6 text-center bg-muted/20 hover:bg-muted/30 transition-colors">
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">Upload tender drawings / BOQ files</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, CAD, ZIP, or DWG up to 25MB each</p>
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      setSelectedFiles(Array.from(e.target.files));
                    }
                  }}
                  className="mt-3 text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                />
              </div>

              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">Files queued for upload:</p>
                  <div className="space-y-1">
                    {selectedFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-muted/40 rounded-xl text-xs">
                        <span className="font-medium text-foreground truncate">{f.name}</span>
                        <span className="text-muted-foreground shrink-0 ml-2">
                          {(f.size / (1024 * 1024)).toFixed(2)} MB
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: REVIEW & PUBLISH */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/30 border border-border rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded">
                      {CATEGORIES.find((c) => c.value === category)?.label}
                    </span>
                    <h4 className="text-base font-bold text-foreground mt-1">{title || "Untitled Tender"}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Project: {projects.find((p) => p.id === projectId)?.name || "Standalone Subcontract"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Deadline</p>
                    <p className="text-xs font-semibold text-foreground">
                      {new Date(submissionDeadline).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Est. Value Range:</span>{" "}
                    <span className="font-semibold text-foreground">
                      {estimatedValueMin ? `₹${parseFloat(estimatedValueMin).toLocaleString("en-IN")}` : "N/A"} -{" "}
                      {estimatedValueMax ? `₹${parseFloat(estimatedValueMax).toLocaleString("en-IN")}` : "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Attached Files:</span>{" "}
                    <span className="font-semibold text-foreground">{selectedFiles.length} file(s)</span>
                  </div>
                </div>

                {scopeDescription && (
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-xs font-semibold text-foreground mb-1">Scope Preview:</p>
                    <div className="text-xs text-muted-foreground bg-background p-3 rounded-xl max-h-36 overflow-y-auto whitespace-pre-wrap font-mono">
                      {scopeDescription}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30">
          <button
            type="button"
            disabled={step === 1 || isSubmitting}
            onClick={() => setStep((prev) => (prev - 1) as any)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>

          {step < 5 ? (
            <button
              type="button"
              disabled={!title.trim() || (step === 3 && !submissionDeadline)}
              onClick={() => {
                if (step === 1 && !scopeDescription) {
                  handleApplyCategoryTemplate();
                }
                setStep((prev) => (prev + 1) as any);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl text-xs shadow-lg shadow-indigo-500/20 transition-all"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSubmitTender("draft")}
                className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground font-medium rounded-xl text-xs transition-colors"
              >
                {isSubmitting ? "Saving…" : "Save as Draft"}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSubmitTender("published")}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-medium rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Publish Now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
