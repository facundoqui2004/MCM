"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { useMindMap } from "../store/mindmap-store";
import { useNoteUi } from "../store/note-ui-store";

/** Imagen de una idea en grande, sobre todo el mapa. Esc o clic afuera cierra. */
export function ImageViewer() {
  const id = useNoteUi((s) => s.imageId);
  const node = useMindMap((s) => (id ? s.nodes[id] : undefined));
  const close = () => useNoteUi.getState().openImage(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!id) return;
    const prev = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      prev?.focus?.();
    };
  }, [id]);

  // la idea se borró o se le quitó la imagen
  useEffect(() => {
    if (id && !node?.image) close();
  }, [id, node]);

  return (
    <AnimatePresence>
      {id && node?.image && (
        <motion.div
          className="mm-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={node.text ? `Imagen de ${node.text}` : "Imagen de la idea"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.figure
            initial={{ scale: 0.94, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL guardada en el mapa */}
            <img src={node.image.src} alt={node.text || "Imagen de la idea"} />
            {node.text.trim() && <figcaption>{node.text}</figcaption>}
            <button ref={closeBtn} type="button" className="mm-viewer-close" aria-label="Cerrar (Esc)" onClick={close}>
              <X size={18} />
            </button>
          </motion.figure>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
