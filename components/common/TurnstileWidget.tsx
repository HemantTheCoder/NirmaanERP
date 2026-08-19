"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import Script from "next/script";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          action?: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: (errorCode?: string) => void;
          theme?: "light" | "dark" | "auto";
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

export interface TurnstileWidgetHandle {
  /** Clear the current token and force a fresh challenge — call after every
   * submit attempt (success or failure), since a token is single-use. */
  reset: () => void;
}

interface TurnstileWidgetProps {
  siteKey: string;
  action?: string;
  onToken: (token: string) => void;
  onExpire?: () => void;
  onError?: (errorCode?: string) => void;
  className?: string;
}

/**
 * Wraps Cloudflare's api.js in a way React can own: api.js expects a plain
 * DOM element to render into, so this renders once the script is ready and
 * cleans up on unmount rather than letting api.js and React fight over the
 * same node.
 */
export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget({ siteKey, action, onToken, onExpire, onError, className }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [scriptReady, setScriptReady] = useState(false);

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
      },
    }));

    useEffect(() => {
      if (!scriptReady || !containerRef.current || !window.turnstile) return;

      const widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action,
        callback: onToken,
        "expired-callback": onExpire,
        "error-callback": onError,
      });
      widgetIdRef.current = widgetId;

      return () => {
        if (window.turnstile && widgetId) {
          window.turnstile.remove(widgetId);
        }
        widgetIdRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scriptReady, siteKey, action]);

    return (
      <>
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          async
          defer
          onReady={() => setScriptReady(true)}
        />
        <div ref={containerRef} className={className} />
      </>
    );
  }
);
