"use client";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

const GAP = 6, EDGE = 12;

/** A scripture reference you can tap (or hover, with a mouse) to read the verse (KJV). */
export function VerseRef({ label, refName, text, above = false }: { label: string; refName: string; text: string; above?: boolean }) {
  const [pos, setPos] = useState<CSSProperties | null>(null);
  const box = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();

  // Placed on screen (fixed), kept inside the viewport on phones; closes on scroll.
  const show = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(320, window.innerWidth - EDGE * 2);
    const left = Math.min(Math.max(r.left + r.width / 2 - width / 2, EDGE), window.innerWidth - width - EDGE);
    setPos(above ? { left, width, bottom: window.innerHeight - r.top + GAP } : { left, width, top: r.bottom + GAP });
  };
  const hide = () => setPos(null);

  useEffect(() => {
    if (!pos) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : e.type !== "pointerdown" || !box.current?.contains(e.target as Node)) hide();
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  return (
    <span ref={box} className="inline"
      onPointerEnter={(e) => { if (e.pointerType === "mouse") show(); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") hide(); }}>
      <button ref={btn} type="button" aria-expanded={!!pos} aria-controls={id} onClick={() => (pos ? hide() : show())}
        className="cursor-pointer whitespace-nowrap font-medium text-gold underline decoration-dotted underline-offset-2 hover:decoration-solid">
        {label}
      </button>
      {pos && (
        <span id={id} role="note" style={pos}
          className="fixed z-50 block whitespace-normal rounded-lg border border-line bg-panel p-3 text-left text-sm not-italic leading-relaxed text-ink shadow-lg">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gold">{refName} · KJV</span>
          {text}
        </span>
      )}
    </span>
  );
}
