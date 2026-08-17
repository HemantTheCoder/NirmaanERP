"use client";

import { Printer } from "lucide-react";

interface PrintExportButtonProps {
  reportTitle: string;
  subtitle?: string;
}

/**
 * Renders an "Export as PDF" button (window.print()) and a print-only report
 * header. The actual print stylesheet (hiding chrome, forcing a print-safe
 * color scheme, avoiding page-break issues) lives in app/globals.css as a
 * plain @media print block — NOT as a <style jsx> tag here, because styled-jsx
 * requires an explicit StyledJsxRegistry in the App Router (see Next.js docs
 * on CSS-in-JS) that this project doesn't set up, so <style jsx> silently
 * never injects anything. A plain global stylesheet has no such requirement.
 */
export function PrintExportButton({ reportTitle, subtitle }: PrintExportButtonProps) {
  return (
    <>
      <div className="print-only mb-6">
        <h1 className="text-2xl font-bold">Nirmaan ERP — {reportTitle}</h1>
        {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
        <p className="text-sm text-gray-600">
          Generated on {new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}
        </p>
      </div>

      <button
        onClick={() => window.print()}
        className="no-print inline-flex items-center gap-2 px-4 py-2.5 bg-card border border-border hover:border-indigo-500/50 text-foreground font-medium rounded-xl text-xs transition-all shrink-0"
      >
        <Printer className="w-4 h-4" />
        Export as PDF
      </button>
    </>
  );
}
