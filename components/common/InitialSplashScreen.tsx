"use client";

import { useEffect, useState } from "react";
import { BrandedLoading } from "./BrandedLoading";

export function InitialSplashScreen() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Check session storage to show 3.5s splash screen on initial launch
    const hasSeenSplash = sessionStorage.getItem("nirmaan_splash_shown");
    if (hasSeenSplash) {
      setShowSplash(false);
    }
  }, []);

  if (!showSplash) return null;

  return (
    <BrandedLoading
      minDurationMs={3500} // 3.5 seconds minimum splash screen duration
      onComplete={() => {
        sessionStorage.setItem("nirmaan_splash_shown", "true");
        setShowSplash(false);
      }}
    />
  );
}
