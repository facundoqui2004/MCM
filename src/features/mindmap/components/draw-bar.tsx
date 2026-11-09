"use client";

import { Check, Eraser, PenLine, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { PEN_COLORS, PEN_WIDTHS } from "../model/colors";
import { useDrawUi } from "../store/draw-ui-store";
import { useMindMap } from "../store/mindmap-store";

/** Barra del lápiz: color, grosor, goma, borrar todo y salir */
export function DrawBar() {
  const { tool, color, width, setTool, setColor, setWidth } = useDrawUi();
  const count = useMindMap((s) => s.drawings.length);
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <AnimatePresence>
      {tool && (
        <motion.div
          className="mm-drawbar"
          role="toolbar"
          aria-label="Lápiz"
          initial={{ opacity: 0, y: 10, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: 8, x: "-50%" }}
          transition={{ type: "spring", stiffness: 480, damping: 34 }}
        >
          <button
            type="button"
            className="mm-format-btn"
            aria-pressed={tool === "pen"}
            title="Lápiz"
            aria-label="Lápiz"
            onClick={() => setTool("pen")}
          >
            <PenLine size={15} />
          </button>
          <button
            type="button"
            className="mm-format-btn"
            aria-pressed={tool === "eraser"}
            title="Goma: pasala sobre un trazo para borrarlo"
            aria-label="Goma"
            onClick={() => setTool("eraser")}
          >
            <Eraser size={15} />
          </button>
          <span className="mm-format-sep" aria-hidden />
          <div className="mm-format-swatches" role="radiogroup" aria-label="Color del lápiz">
            {PEN_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                role="radio"
                aria-checked={tool === "pen" && color === c.hex}
                aria-label={c.name}
                title={c.name}
                className="mm-swatch"
                style={{ background: c.hex }}
                onClick={() => setColor(c.hex)}
              />
            ))}
          </div>
          <span className="mm-format-sep" aria-hidden />
          <div className="mm-format-swatches" role="radiogroup" aria-label="Grosor">
            {PEN_WIDTHS.map((w, i) => (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={tool === "pen" && width === w}
                aria-label={["Fino", "Medio", "Grueso"][i]}
                title={["Fino", "Medio", "Grueso"][i]}
                className="mm-width"
                onClick={() => setWidth(w)}
              >
                <i style={{ width: w + 3, height: w + 3, background: color }} />
              </button>
            ))}
          </div>
          <span className="mm-format-sep" aria-hidden />
          <button
            type="button"
            className={`mm-format-btn ${confirmClear ? "is-danger" : ""}`}
            disabled={!count}
            title={confirmClear ? "Tocá de nuevo para borrar todos los dibujos (Ctrl Z los recupera)" : "Borrar todos los dibujos"}
            aria-label={confirmClear ? "Confirmar: borrar todos los dibujos" : "Borrar todos los dibujos"}
            onBlur={() => setConfirmClear(false)}
            onClick={() => {
              if (!confirmClear) return setConfirmClear(true);
              useMindMap.getState().removeStrokes(useMindMap.getState().drawings.map((d) => d.id));
              setConfirmClear(false);
            }}
          >
            <Trash2 size={15} />
          </button>
          <button type="button" className="mm-drawbar-done" title="Terminar de dibujar (Esc)" onClick={() => setTool(null)}>
            <Check size={15} />
            Listo
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
