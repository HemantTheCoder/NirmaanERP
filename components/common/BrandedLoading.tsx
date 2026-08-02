"use client";

import Image from "next/image";

export function BrandedLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#4F46E5] text-white">
      <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Nirmaan Indigo Monogram Logo */}
        <div className="w-20 h-20 rounded-2xl bg-white text-[#4F46E5] flex items-center justify-center shadow-2xl p-3">
          <svg viewBox="0 0 512 512" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="96" y="96" width="57.6" height="320" fill="#4F46E5"/>
            <polygon points="153.6,96 211.2,96 358.4,358.4 358.4,416 300.8,416 153.6,153.6" fill="#4F46E5"/>
            <rect x="300.8" y="96" width="57.6" height="320" fill="#4F46E5"/>
            <line x1="358.4" y1="57.6" x2="448" y2="57.6" stroke="#F59E0B" strokeWidth="12" strokeLinecap="round"/>
            <circle cx="448" cy="57.6" r="14" fill="#F59E0B"/>
          </svg>
        </div>

        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">Nirmaan ERP</h1>
          <p className="text-xs text-indigo-100/80 font-medium">Construction Operations Platform</p>
        </div>

        {/* Subtle Loading Spinner */}
        <div className="pt-4 flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 rounded-full bg-white animate-bounce" />
        </div>
      </div>
    </div>
  );
}
