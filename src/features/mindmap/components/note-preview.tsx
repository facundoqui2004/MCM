"use client";

import { autoUpdate, flip, FloatingPortal, offset, shift, size, useFloating } from "@floating-ui/react";
import { Pin } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { countWords, renderNoteMarkdown } from "../model/note-markdown";
import { accentOf } from "../model/palette";
import { useMindMap } from "../store/mindmap-store";
import { useNoteUi } from "../store/note-ui-store";

/** Demora antes de abrir. Solo las ideas con nota muestran vista previa:
 *  las vacías se abren con Ctrl Enter o con el botón de nota del nodo. */
const OPEN_WITH_NOTE = 450;
/** Si ya hay una vista previa abierta, pasar a otra idea es casi instantáneo */
const OPEN_SWITCH = 90;
/** Margen para cruzar del nodo a la tarjeta sin que se cierre */
const GRACE = 220;

const nodeEl = (id: string) =>
  document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(id)}"]`);

/**
 * Vista previa flotante (como el Page Preview de Obsidian): aparece al dejar el
 * cursor sobre una idea y muestra su nota. Un clic izquierdo la fija como
 * ventana editable (NoteWindow).
 */
export function NotePreview() {
  const hoverId = useNoteUi((s) => s.hoverId);
  const pinned = useNoteUi((s) => s.pinned);
  const busy = useMindMap((s) => s.editingId !== null || s.dragging);
  const [shownId, setShownId] = useState<string | null>(null);
  const shownRef = useRef<string | null>(null);
  const inside = useRef(false);
  shownRef.current = shownId;

  const node = useMindMap((s) => (shownId ? s.nodes[shownId] : undefined));

  useEffect(() => {
    if (busy) {
      setShownId(null);
      return;
    }
    if (hoverId) {
      // si la nota ya está fijada en una ventana, no hace falta la vista previa
      if (pinned.some((p) => p.id === hoverId)) return;
      if (shownRef.current === hoverId) return;
      const hasNote = !!useMindMap.getState().nodes[hoverId]?.note?.trim();
      if (hasNote) {
        const t = setTimeout(() => setShownId(hoverId), shownRef.current ? OPEN_SWITCH : OPEN_WITH_NOTE);
        return () => clearTimeout(t);
      }
      // idea sin nota: si había otra vista previa abierta, se cierra igual que al salir
    }
    const t = setTimeout(() => {
      if (!inside.current) setShownId(null);
    }, GRACE);
    return () => clearTimeout(t);
  }, [hoverId, busy, pinned]);

  // Esc cierra la vista previa
  useEffect(() => {
    if (!shownId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShownId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shownId]);

  // la idea se borró mientras se mostraba
  useEffect(() => {
    if (shownId && !node) setShownId(null);
  }, [shownId, node]);

  const { refs, floatingStyles, placement } = useFloating({
    open: !!shownId,
    placement: "bottom",
    middleware: [
      offset(12),
      flip({ padding: 12, fallbackPlacements: ["top", "right", "left"] }),
      shift({ padding: 12 }),
      size({
        padding: 12,
        apply({ availableHeight, elements }) {
          elements.floating.style.maxHeight = `${Math.max(140, Math.min(380, availableHeight))}px`;
        },
      }),
    ],
    // el lienzo se mueve con zoom y paneo: seguir al nodo cuadro a cuadro
    whileElementsMounted: (ref, float, update) => autoUpdate(ref, float, update, { animationFrame: true }),
  });

  useLayoutEffect(() => {
    refs.setReference(shownId ? nodeEl(shownId) : null);
  }, [shownId, refs]);

  const pinIt = () => {
    if (!shownId) return;
    const el = refs.floating.current;
    const r = el?.getBoundingClientRect();
    useMindMap.getState().select(shownId);
    useNoteUi.getState().pin(shownId, r ? { x: r.left, y: r.top } : undefined);
    inside.current = false;
    setShownId(null);
  };

  const note = node?.note?.trim() ? node.note : "";
  const words = countWords(note);
  const side = placement.split("-")[0];
  const from = side === "top" ? 6 : side === "bottom" ? -6 : 0;

  return (
    <FloatingPortal>
      <AnimatePresence>
        {shownId && node && (
          <div ref={refs.setFloating} style={{ ...floatingStyles, zIndex: 60 }} className="mm-note-anchor">
            <motion.div
              key={shownId}
              role="dialog"
              aria-label={`Nota de ${node.text || "idea sin título"}`}
              className="mm-note mm-note--preview"
              style={{ ["--accent" as string]: accentOf(node.color, node.parentId === null) }}
              initial={{ opacity: 0, y: from, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: from / 2, scale: 0.98, transition: { duration: 0.12 } }}
              transition={{ type: "spring", stiffness: 520, damping: 34 }}
              onMouseEnter={() => (inside.current = true)}
              onMouseLeave={() => {
                inside.current = false;
                setTimeout(() => {
                  if (!inside.current && !useNoteUi.getState().hoverId) setShownId(null);
                }, GRACE);
              }}
              onPointerDown={(e) => {
                if (e.button === 0) e.preventDefault(); // no robar el foco del lienzo
              }}
              onClick={(e) => {
                if (e.button === 0) pinIt();
              }}
              title="Clic para fijar y escribir"
            >
              <header className="mm-note-head">
                <span className="mm-note-dot" aria-hidden />
                <span className="mm-note-title">{node.text || "Idea sin título"}</span>
                <button
                  type="button"
                  className="mm-note-btn"
                  aria-label="Fijar nota"
                  title="Fijar (clic)"
                  onClick={(e) => {
                    e.stopPropagation();
                    pinIt();
                  }}
                >
                  <Pin size={13} />
                </button>
              </header>
              <div className="mm-note-body mm-md">
                {note ? (
                  renderNoteMarkdown(note)
                ) : (
                  <p className="mm-note-empty">Esta idea todavía no tiene nota. Hacé clic para escribirla.</p>
                )}
              </div>
              <footer className="mm-note-foot">
                <span>{note ? `${words} ${words === 1 ? "palabra" : "palabras"}` : "Vacía"}</span>
                <span>Clic para fijar y editar</span>
              </footer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </FloatingPortal>
  );
}

/** Para pruebas y para que el resto del editor sepa el selector */
export { nodeEl as noteAnchorOf };
