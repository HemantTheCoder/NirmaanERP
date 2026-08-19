"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const FADE_DURATION_MS = 500;

interface BrandedLoadingProps {
  minDurationMs?: number; // default 3500ms (3.5 seconds)
  onComplete?: () => void;
  className?: string;
}

export function BrandedLoading({
  minDurationMs = 3500,
  onComplete,
  className,
}: BrandedLoadingProps) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  // Callers pass onComplete as an inline arrow, so its identity changes on
  // every parent render. Holding it in a ref keeps it out of the timer
  // effect's dependency array — otherwise any parent re-render during the
  // countdown (auth resolving, a route transition) would tear down and
  // restart the timer, and a parent that re-renders steadily would keep the
  // splash on screen forever.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  // Runs once on mount: the countdown starts exactly once and nothing the
  // parent does can restart it. minDurationMs is read from the first render,
  // which is correct — callers pass a fixed duration.
  useEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;

    const timer = setTimeout(() => {
      setFading(true);
      fadeTimer = setTimeout(() => {
        setVisible(false);
        onCompleteRef.current?.();
      }, FADE_DURATION_MS);
    }, minDurationMs);

    // Both timers are cleared here. Previously the fade cleanup was returned
    // from the setTimeout callback rather than the effect, so it never ran and
    // the fade timer could fire after unmount.
    return () => {
      clearTimeout(timer);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#4F46E5] text-white transition-opacity duration-500 ease-out select-none",
        fading ? "opacity-0 pointer-events-none" : "opacity-100",
        className
      )}
    >
      <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in-95 duration-300">
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
          <p className="text-xs text-indigo-100/90 font-medium tracking-wide">
            Construction Operations Platform
          </p>
        </div>

        {/* Animated Bouncing Dots */}
        <div className="pt-4 flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 rounded-full bg-white animate-bounce" />
        </div>
      </div>
    </div>
  );
}
