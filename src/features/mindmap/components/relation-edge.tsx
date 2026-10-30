"use client";

import { EdgeLabelRenderer, useInternalNode, type EdgeProps, type InternalNode } from "@xyflow/react";
import { ArrowLeftRight, PencilLine, Trash2 } from "lucide-react";
import { memo, useLayoutEffect, useRef, useState } from "react";
import type { XY } from "../model/types";
import { useMindMap } from "../store/mindmap-store";

/** Punto del borde de la caja del nodo en dirección a `toward` (con un margen para la punta) */
function borderPoint(n: InternalNode, toward: XY, gap: number): XY {
  const w = n.measured.width ?? 0;
  const h = n.measured.height ?? 0;
  const p = n.internals.positionAbsolute;
  const c = { x: p.x + w / 2, y: p.y + h / 2 };
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (!dx && !dy) return c;
  // las ideas son "píldoras": se recorta un poco la caja para no despegarse de los extremos redondeados
  const hw = w / 2 - Math.min(h / 2, w / 2) * 0.18;
  const hh = h / 2;
  const scale = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  const len = Math.hypot(dx, dy);
  return { x: c.x + dx * scale + (dx / len) * gap, y: c.y + dy * scale + (dy / len) * gap };
}

function centerOfNode(n: InternalNode): XY {
  const p = n.internals.positionAbsolute;
  return { x: p.x + (n.measured.width ?? 0) / 2, y: p.y + (n.measured.height ?? 0) / 2 };
}

function LabelEditor({ id, initial }: { id: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useLayoutEffect(() => {
    // como en el editor de ideas: el elemento puede tardar un cuadro en poder recibir foco
    let raf = 0;
    let tries = 0;
    const tryFocus = () => {
      const el = ref.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      if (document.activeElement === el) el.select();
      else if (tries++ < 20) raf = requestAnimationFrame(tryFocus);
    };
    tryFocus();
    return () => cancelAnimationFrame(raf);
  }, []);
  const finish = (v: string | null) => {
    if (done.current) return;
    done.current = true;
    useMindMap.getState().commitRelationLabel(id, v);
  };
  return (
    <input
      ref={ref}
      className="mm-rel-input nodrag nopan"
      value={value}
      maxLength={200}
      placeholder="Nombre de la relación"
      aria-label="Nombre de la relación"
      size={Math.max(12, Math.min(40, value.length + 2))}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          finish(value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(null);
        }
      }}
    />
  );
}

/**
 * Flecha de relación libre (como las "relaciones" de XMind): curva punteada que
 * une dos ideas cualesquiera, con punta de flecha y un nombre opcional en el medio.
 */
function RelationEdgeImpl({ id, source, target, data }: EdgeProps) {
  const relId = (data as { relId: string }).relId;
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  const label = useMindMap((st) => st.relations.find((r) => r.id === relId)?.label ?? "");
  const selected = useMindMap((st) => st.selectedRelationId === relId);
  const editing = useMindMap((st) => st.editingRelationId === relId);
  const touchesSelected = useMindMap((st) => st.selectedId === source || st.selectedId === target);
  const rootId = useMindMap((st) => st.rootId);
  const root = useInternalNode(rootId);
  if (!s || !t || !s.measured.width || !t.measured.width) return null;

  const sc = centerOfNode(s);
  const tc = centerOfNode(t);
  const len = Math.hypot(tc.x - sc.x, tc.y - sc.y) || 1;
  // La curva se arquea hacia afuera del mapa (lejos de la idea central), donde hay
  // espacio libre, y con un arco mínimo para que el nombre no quede sobre las ideas.
  const bend = Math.min(170, Math.max(70, len * 0.3));
  let nx = -(tc.y - sc.y) / len;
  let ny = (tc.x - sc.x) / len;
  if (root?.measured.width) {
    const rc = centerOfNode(root);
    const mx = (sc.x + tc.x) / 2 - rc.x;
    const my = (sc.y + tc.y) / 2 - rc.y;
    if (mx * nx + my * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
  }
  const ctrl = { x: (sc.x + tc.x) / 2 + nx * bend, y: (sc.y + tc.y) / 2 + ny * bend };
  const p0 = borderPoint(s, ctrl, 3);
  const p2 = borderPoint(t, ctrl, 6);
  const path = `M ${p0.x} ${p0.y} Q ${ctrl.x} ${ctrl.y} ${p2.x} ${p2.y}`;
  const mid = { x: 0.25 * p0.x + 0.5 * ctrl.x + 0.25 * p2.x, y: 0.25 * p0.y + 0.5 * ctrl.y + 0.25 * p2.y };
  const marker = `mm-rel-arrow-${id}`;
  const state = selected ? "is-selected" : touchesSelected ? "is-related" : "";

  const st = useMindMap.getState;
  return (
    <>
      <g className={`mm-rel ${state}`}>
        <defs>
          <marker id={marker} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0.8 L 9 5 L 0 9.2 L 2.4 5 Z" className="mm-rel-head" />
          </marker>
        </defs>
        {/* zona invisible y ancha para que sea fácil hacer clic sobre la flecha */}
        <path d={path} className="mm-rel-hit" fill="none" />
        {selected && <path d={path} className="mm-rel-glow" fill="none" />}
        <path d={path} className="mm-rel-line" fill="none" markerEnd={`url(#${marker})`} />
      </g>
      <EdgeLabelRenderer>
        <div
          className={`mm-rel-label nodrag nopan ${state}`}
          style={{ transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)` }}
          onClick={(e) => {
            e.stopPropagation();
            st().selectRelation(relId);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            st().startRelationEdit(relId);
          }}
        >
          {editing ? (
            <LabelEditor id={relId} initial={label} />
          ) : label ? (
            <span className="mm-rel-text" title="Doble clic para renombrar">{label}</span>
          ) : selected ? (
            <span className="mm-rel-text mm-rel-text--empty">Sin nombre</span>
          ) : (
            // sin nombre: un punto en el medio sirve de agarre para seleccionarla
            <span className="mm-rel-dot" aria-hidden />
          )}
          {selected && !editing && (
            <div className="mm-rel-tools" role="toolbar" aria-label="Acciones de la relación">
              <button type="button" className="mm-rel-btn" title="Nombrar (F2 o doble clic)" aria-label="Nombrar relación" onClick={() => st().startRelationEdit(relId)}>
                <PencilLine size={13} />
              </button>
              <button type="button" className="mm-rel-btn" title="Invertir el sentido de la flecha" aria-label="Invertir sentido" onClick={() => st().reverseRelation(relId)}>
                <ArrowLeftRight size={13} />
              </button>
              <button type="button" className="mm-rel-btn mm-rel-btn--danger" title="Borrar relación (Supr)" aria-label="Borrar relación" onClick={() => st().deleteRelation(relId)}>
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const RelationEdge = memo(RelationEdgeImpl);
