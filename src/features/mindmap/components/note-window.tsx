"use client";

import { Crosshair, Eye, PencilLine, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { countWords, renderNoteMarkdown } from "../model/note-markdown";
import { accentOf } from "../model/palette";
import { useMindMap } from "../store/mindmap-store";
import { useNoteUi, type PinnedNote } from "../store/note-ui-store";

const W = 380;
/** Mismo tope que el esquema de la API: una nota más larga no se podría guardar */
const NOTE_MAX = 20000;

function clamp(pos: { x: number; y: number }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // la ventana entera debe quedar adentro a lo ancho (en celulares ocupa casi todo)
  const w = Math.min(W, vw - 16);
  return {
    x: Math.min(Math.max(8, pos.x), Math.max(8, vw - w - 8)),
    y: Math.min(Math.max(8, pos.y), Math.max(8, vh - 60)),
  };
}

/**
 * Ventana de nota fijada: se arrastra por la barra superior, se escribe adentro
 * y cada cambio se guarda solo en el mapa (con el mismo autoguardado del resto).
 */
function NoteWindow({ pin }: { pin: PinnedNote }) {
  const { id } = pin;
  const node = useMindMap((s) => s.nodes[id]);
  const ui = useNoteUi.getState;
  const area = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<"edit" | "read">("edit");
  // el primer cambio de cada sesión de escritura entra al historial (Ctrl Z lo revierte entero)
  const typing = useRef(false);

  // la idea se borró (o se deshizo su creación): cerrar
  useEffect(() => {
    if (!node) ui().unpin(id);
  }, [node, id, ui]);

  useLayoutEffect(() => {
    if (!pin.focusOnOpen) return;
    setMode("edit");
    let raf = 0;
    let tries = 0;
    const tryFocus = () => {
      const el = area.current;
      if (el) {
        el.focus({ preventScroll: true });
        if (document.activeElement === el) {
          el.setSelectionRange(el.value.length, el.value.length);
          ui().consumeFocus(id);
          return;
        }
      }
      if (tries++ < 20) raf = requestAnimationFrame(tryFocus);
    };
    tryFocus();
    return () => cancelAnimationFrame(raf);
  }, [pin.focusOnOpen, id, ui]);

  if (!node) return null;
  const note = node.note ?? "";
  const shown = typeof window === "undefined" ? pin.pos : clamp(pin.pos);

  /** Guarda en el mapa; el primer cambio de cada tanda entra al historial */
  const write = (value: string, selStart?: number, selEnd?: number) => {
    useMindMap.getState().setNote(id, value, { history: !typing.current });
    typing.current = true;
    if (selStart !== undefined) {
      requestAnimationFrame(() => area.current?.setSelectionRange(selStart, selEnd ?? selStart));
    }
  };
  const words = countWords(note);

  const startDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    const origin = shown;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) =>
      ui().move(id, clamp({ x: origin.x + ev.clientX - start.x, y: origin.y + ev.clientY - start.y }));
    const onUp = () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  };

  return (
    <motion.section
      role="dialog"
      aria-label={`Nota de ${node.text || "idea sin título"}`}
      className="mm-note mm-note--pinned"
      style={{ left: shown.x, top: shown.y, width: W, zIndex: 70 + pin.z, ["--accent" as string]: accentOf(node.color, node.parentId === null) }}
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
      transition={{ type: "spring", stiffness: 500, damping: 34 }}
      onPointerDownCapture={() => ui().raise(id)}
      onKeyDown={(e) => {
        // las teclas de adentro no llegan a los atajos del mapa
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          ui().unpin(id);
        }
      }}
    >
      <header className="mm-note-head mm-note-head--drag" onPointerDown={startDrag}>
        <span className="mm-note-dot" aria-hidden />
        <span className="mm-note-title">{node.text || "Idea sin título"}</span>
        <button
          type="button"
          className="mm-note-btn"
          aria-label="Ir a la idea"
          title="Seleccionar la idea en el mapa"
          onClick={() => {
            const s = useMindMap.getState();
            s.reveal(id);
            s.select(id);
          }}
        >
          <Crosshair size={13} />
        </button>
        <button
          type="button"
          className="mm-note-btn"
          aria-pressed={mode === "read"}
          aria-label={mode === "edit" ? "Ver como lectura" : "Editar"}
          title={mode === "edit" ? "Vista de lectura" : "Editar"}
          onClick={() => setMode((m) => (m === "edit" ? "read" : "edit"))}
        >
          {mode === "edit" ? <Eye size={13} /> : <PencilLine size={13} />}
        </button>
        <button type="button" className="mm-note-btn" aria-label="Cerrar nota" title="Cerrar (Esc)" onClick={() => ui().unpin(id)}>
          <X size={14} />
        </button>
      </header>

      {mode === "edit" ? (
        <textarea
          ref={area}
          className="mm-note-area"
          value={note}
          spellCheck
          placeholder={"Escribí la nota de esta idea…\n\n# Título  ·  - lista  ·  **negrita**  ·  [[enlace]]  ·  #etiqueta"}
          aria-label="Texto de la nota"
          maxLength={NOTE_MAX}
          onChange={(e) => write(e.target.value)}
          onKeyDown={(e) => {
            // Tab sangra (como en Obsidian) en vez de sacar el foco de la nota:
            // si el foco se fuera, Supr o una letra actuarían sobre el mapa.
            if (e.key !== "Tab" || e.ctrlKey || e.metaKey || e.altKey) return;
            e.preventDefault();
            const el = e.currentTarget;
            const { selectionStart: a, selectionEnd: b, value } = el;
            const lineStart = value.lastIndexOf("\n", a - 1) + 1;
            if (e.shiftKey) {
              const lead = /^ {1,2}|^\t/.exec(value.slice(lineStart))?.[0].length ?? 0;
              if (!lead) return;
              write(value.slice(0, lineStart) + value.slice(lineStart + lead), Math.max(lineStart, a - lead), Math.max(lineStart, b - lead));
            } else {
              const listLine = /^\s*([-*]|\d+\.)\s/.test(value.slice(lineStart));
              const at = listLine ? lineStart : a;
              if (value.length + 2 > NOTE_MAX) return;
              write(value.slice(0, at) + "  " + value.slice(at), a + 2, b + 2);
            }
          }}
          onBlur={() => (typing.current = false)}
        />
      ) : (
        <div className="mm-note-body mm-md mm-note-read" onDoubleClick={() => setMode("edit")}>
          {note.trim() ? renderNoteMarkdown(note) : <p className="mm-note-empty">Nota vacía. Doble clic para escribir.</p>}
        </div>
      )}

      <footer className="mm-note-foot">
        <span>
          {words} {words === 1 ? "palabra" : "palabras"}
        </span>
        <span>Se guarda solo</span>
      </footer>
    </motion.section>
  );
}

export function NoteWindows() {
  const pinned = useNoteUi((s) => s.pinned);
  const [mounted, setMounted] = useState(false);
  const [, setViewport] = useState(0);
  useEffect(() => {
    setMounted(true);
    // si la pantalla se achica (girar el celular, achicar la ventana) las notas se reacomodan adentro
    const onResize = () => setViewport((v) => v + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  if (!mounted) return null;
  // portal propio (no el de floating-ui): así los botones de la ventana siguen
  // siendo alcanzables con Tab
  return createPortal(
    <AnimatePresence>
      {pinned.map((p) => (
        <NoteWindow key={p.id} pin={p} />
      ))}
    </AnimatePresence>,
    document.body,
  );
}
