"use client";
import { useEffect, useRef } from "react";

declare global {
  interface Window { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string } }
}

/** Cloudflare Turnstile widget. Adds a hidden "cf-turnstile-response" field to the form. */
export function Turnstile({ siteKey }: { siteKey: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!siteKey || !ref.current) return;
    const render = () => window.turnstile?.render(ref.current!, { sitekey: siteKey, theme: "dark" });
    if (window.turnstile) return void render();
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }, [siteKey]);
  if (!siteKey) return null;
  return <div ref={ref} className="min-h-16" />;
}
