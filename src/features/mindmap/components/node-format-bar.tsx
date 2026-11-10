"use client";

import { NodeToolbar, Position } from "@xyflow/react";
import { Ban, Bold, Lock, LockOpen, Underline } from "lucide-react";
import { useEffect, useRef } from "react";
import { FILL_SWATCHES } from "../model/colors";
import { lockOwner } from "../model/tree";
import { useMindMap } from "../store/mindmap-store";

/**
 * Barrita de formato sobre la idea elegida: color de relleno, negrita y
 * subrayado. Se muestra arriba de la idea (React Flow la acomoda con el zoom).
 */
export function NodeFormatBar({ id, visible }: { id: string; visible: boolean }) {
  const fill = useMindMap((s) => s.nodes[id]?.fill);
  const bold = useMindMap((s) => !!s.nodes[id]?.bold);
  const underline = useMindMap((s) => !!s.nodes[id]?.underline);
  // quién la tiene fija: ella misma o una idea de más arriba
  const owner = useMindMap((s) => lockOwner(s.nodes, id));
  const ownerText = useMindMap((s) => (owner && owner !== id ? s.nodes[owner]?.text || "otra idea" : null));
  const locked = owner === id;
  const picker = useRef<HTMLInputElement>(null);
  const set = (patch: Parameters<ReturnType<typeof useMindMap.getState>["setNodeStyle"]>[1]) =>
    useMindMap.getState().setNodeStyle([id], patch);
  const custom = fill && !FILL_SWATCHES.some((c) => c.hex === fill) ? fill : null;

  // el selector del sistema avisa "change" una sola vez al elegir (y no en cada
  // movimiento): así queda un solo paso para Ctrl Z
  useEffect(() => {
    const el = picker.current;
    if (!el) return;
    const onPick = () => useMindMap.getState().setNodeStyle([id], { fill: el.value.toLowerCase() });
    el.addEventListener("change", onPick);
    return () => el.removeEventListener("change", onPick);
  }, [id, visible]);

  return (
    <NodeToolbar isVisible={visible} position={Position.Top} offset={30} className="nodrag nopan">
      <div
        className="mm-format"
        role="toolbar"
        aria-label="Formato de la idea"
        // que un clic en la barra no le saque la selección a la idea
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.preventDefault()}
      >
        <button
          type="button"
          className="mm-format-btn"
          aria-pressed={locked || !!ownerText}
          aria-label={locked ? "Desbloquear la idea" : "Bloquear la idea y su rama"}
          disabled={!!ownerText}
          title={
            ownerText
              ? `Está fija porque «${ownerText}» está bloqueada: desbloqueala ahí`
              : locked
                ? "Bloqueada: ella y su rama están fijas. Clic para desbloquear"
                : "Bloquear: deja fija esta idea y toda su rama"
          }
          onClick={() => useMindMap.getState().toggleLock(id)}
        >
          {locked || ownerText ? <Lock size={14} strokeWidth={2.4} /> : <LockOpen size={14} strokeWidth={2.2} />}
        </button>
        <span className="mm-format-sep" aria-hidden />
        <button
          type="button"
          className="mm-format-btn"
          aria-pressed={bold}
          aria-label="Negrita"
          title="Negrita (Ctrl B)"
          onClick={() => set({ bold: !bold })}
        >
          <Bold size={14} strokeWidth={2.6} />
        </button>
        <button
          type="button"
          className="mm-format-btn"
          aria-pressed={underline}
          aria-label="Subrayado"
          title="Subrayado (Ctrl U)"
          onClick={() => set({ underline: !underline })}
        >
          <Underline size={14} strokeWidth={2.4} />
        </button>
        <span className="mm-format-sep" aria-hidden />
        <div className="mm-format-swatches" role="radiogroup" aria-label="Color de relleno">
          {FILL_SWATCHES.map((c) => (
            <button
              key={c.hex}
              type="button"
              role="radio"
              aria-checked={fill === c.hex}
              aria-label={c.name}
              title={c.name}
              className="mm-swatch"
              style={{ background: c.hex }}
              onClick={() => set({ fill: fill === c.hex ? null : c.hex })}
            />
          ))}
          {/* color a elección */}
          <button
            type="button"
            role="radio"
            aria-checked={!!custom}
            aria-label="Elegir otro color"
            title="Otro color…"
            className="mm-swatch mm-swatch--custom"
            style={custom ? { background: custom } : undefined}
            onClick={() => picker.current?.click()}
          />
          <input
            ref={picker}
            type="color"
            className="mm-format-picker"
            tabIndex={-1}
            aria-hidden
            defaultValue={fill ?? "#fde68a"}
          />
          <button
            type="button"
            className="mm-format-btn mm-format-btn--small"
            aria-label="Quitar color"
            title="Sin color (el del tema)"
            disabled={!fill}
            onClick={() => set({ fill: null })}
          >
            <Ban size={13} />
          </button>
        </div>
      </div>
    </NodeToolbar>
  );
}
