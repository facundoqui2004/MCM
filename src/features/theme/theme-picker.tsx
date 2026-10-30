"use client";

import { Check, Palette } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "./theme-store";
import { THEMES } from "./themes";

/** Selector de tema: botón con menú de muestras. Se cierra con Esc o clic afuera. */
export function ThemePicker({ className = "" }: { className?: string }) {
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={root} className={`mm-theme ${className}`}>
      <button type="button" className="mm-chip" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)} title="Cambiar el tema">
        <Palette size={15} />
        <span>Tema</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="mm-theme-menu"
            role="radiogroup"
            aria-label="Tema"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
          >
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={theme === t.id}
                className="mm-theme-option"
                onClick={() => {
                  setTheme(t.id);
                  setOpen(false);
                }}
              >
                <span className="mm-theme-swatch" style={{ background: t.swatch.bg }} aria-hidden>
                  <i style={{ backgroundImage: `linear-gradient(${t.swatch.bg}, ${t.swatch.bg}), ${t.swatch.ring}` }} />
                </span>
                <span>
                  {t.name}
                  <small>{t.description}</small>
                </span>
                {theme === t.id && <Check size={15} className="mm-theme-check" aria-hidden />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
