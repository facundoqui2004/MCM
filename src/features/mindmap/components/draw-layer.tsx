"use client";

import { useReactFlow, ViewportPortal } from "@xyflow/react";
import { nanoid } from "nanoid";
import { memo, useEffect, useRef, useState } from "react";
import type { Stroke, XY } from "../model/types";
import { useDrawUi } from "../store/draw-ui-store";
import { useMindMap } from "../store/mindmap-store";

/**
 * Dibujo a mano alzada sobre el mapa.
 *
 * - Los trazos se guardan en coordenadas del lienzo y se pintan dentro del
 *   viewport de React Flow: acompañan el zoom y el paneo como las ideas.
 * - Con el lápiz activo, una capa transparente toma el mouse/lápiz/dedo: arrastrar
 *   dibuja, la rueda hace zoom y Espacio + arrastrar (o el botón del medio) mueve el lienzo.
 * - La goma borra los trazos que toca; todo se deshace con Ctrl Z.
 */

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 2.5;

/** Curva suave que pasa por los puntos (cuadráticas por los puntos medios) */
export function strokePath(p: number[]): string {
  if (p.length < 4) return `M ${p[0]} ${p[1]} l 0.01 0`;
  let d = `M ${p[0]} ${p[1]}`;
  for (let i = 2; i < p.length - 2; i += 2) {
    const mx = (p[i] + p[i + 2]) / 2;
    const my = (p[i + 1] + p[i + 3]) / 2;
    d += ` Q ${p[i]} ${p[i + 1]} ${mx} ${my}`;
  }
  return `${d} L ${p[p.length - 2]} ${p[p.length - 1]}`;
}

/** Saca puntos que no cambian la forma (Ramer–Douglas–Peucker): el mapa guardado pesa menos */
function simplify(p: number[], eps: number): number[] {
  const n = p.length / 2;
  if (n <= 2) return p;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const ax = p[a * 2], ay = p[a * 2 + 1], bx = p[b * 2], by = p[b * 2 + 1];
    const len = Math.hypot(bx - ax, by - ay);
    let far = -1;
    let best = eps;
    for (let i = a + 1; i < b; i++) {
      // si el tramo empieza y termina en el mismo lugar (un círculo cerrado), la
      // distancia a la "recta" no sirve: se mide al punto de inicio
      const d =
        len < 1e-6
          ? Math.hypot(p[i * 2] - ax, p[i * 2 + 1] - ay)
          : Math.abs((bx - ax) * (ay - p[i * 2 + 1]) - (ax - p[i * 2]) * (by - ay)) / len;
      if (d > best) {
        best = d;
        far = i;
      }
    }
    if (far >= 0) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(Math.round(p[i * 2] * 10) / 10, Math.round(p[i * 2 + 1] * 10) / 10);
  return out;
}

/** Distancia de un punto a un trazo (para la goma) */
function distanceToStroke(q: XY, p: number[]): number {
  if (p.length < 4) return Math.hypot(q.x - p[0], q.y - p[1]);
  let best = Infinity;
  for (let i = 0; i < p.length - 2; i += 2) {
    const ax = p[i], ay = p[i + 1], bx = p[i + 2], by = p[i + 3];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((q.x - ax) * dx + (q.y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(q.x - (ax + t * dx), q.y - (ay + t * dy)));
  }
  return best;
}

const Drawings = memo(function Drawings({ strokes, hidden }: { strokes: Stroke[]; hidden: Set<string> }) {
  return (
    <>
      {strokes.map((s) =>
        hidden.has(s.id) ? null : (
          <path key={s.id} d={strokePath(s.points)} stroke={s.color} strokeWidth={s.width} />
        ),
      )}
    </>
  );
});

export function DrawLayer() {
  const strokes = useMindMap((s) => s.drawings);
  const tool = useDrawUi((s) => s.tool);
  const rf = useReactFlow();
  const capture = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<{ points: number[]; color: string; width: number } | null>(null);
  const [erasing, setErasing] = useState<Set<string>>(() => new Set());
  const gesture = useRef<
    | { kind: "draw"; pid: number; points: number[]; lastScreen: XY; color: string; width: number }
    | { kind: "erase"; pid: number; ids: Set<string> }
    | { kind: "pan"; pid: number; start: XY; vp: { x: number; y: number; zoom: number } }
    | null
  >(null);
  const space = useRef(false);

  // Espacio = mover el lienzo; Esc = salir del lápiz
  useEffect(() => {
    if (!tool) return;
    const down = (e: KeyboardEvent) => {
      if (e.key === " ") space.current = true;
      if (e.key === "Escape") {
        e.stopPropagation();
        useDrawUi.getState().setTool(null);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === " ") space.current = false;
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up);
    };
  }, [tool]);

  // rueda = zoom alrededor del puntero (la capa del lápiz tapa al lienzo, así que se hace a mano)
  useEffect(() => {
    const el = capture.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { x, y, zoom } = rf.getViewport();
      const box = el.getBoundingClientRect();
      const px = e.clientX - box.left;
      const py = e.clientY - box.top;
      const step = e.deltaMode === 1 ? e.deltaY * 0.05 : e.deltaY * 0.002;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * Math.pow(2, -step * (e.ctrlKey ? 4 : 1))));
      void rf.setViewport({ x: px - ((px - x) * next) / zoom, y: py - ((py - y) * next) / zoom, zoom: next });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [rf, tool]);

  const flowAt = (e: React.PointerEvent) => rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });

  const eraseAt = (e: React.PointerEvent, ids: Set<string>) => {
    const q = flowAt(e);
    const zoom = rf.getViewport().zoom;
    let changed = false;
    for (const s of useMindMap.getState().drawings) {
      if (ids.has(s.id)) continue;
      if (distanceToStroke(q, s.points) <= s.width / 2 + 7 / zoom) {
        ids.add(s.id);
        changed = true;
      }
    }
    if (changed) setErasing(new Set(ids));
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gesture.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (e.button === 1 || space.current) {
      gesture.current = { kind: "pan", pid: e.pointerId, start: { x: e.clientX, y: e.clientY }, vp: rf.getViewport() };
      return;
    }
    if (e.button !== 0) return;
    const ui = useDrawUi.getState();
    if (ui.tool === "eraser") {
      const ids = new Set<string>();
      gesture.current = { kind: "erase", pid: e.pointerId, ids };
      eraseAt(e, ids);
      return;
    }
    const p = flowAt(e);
    const zoom = rf.getViewport().zoom;
    // el grosor se elige en píxeles de pantalla y se guarda en unidades del lienzo
    const g = { kind: "draw" as const, pid: e.pointerId, points: [p.x, p.y], lastScreen: { x: e.clientX, y: e.clientY }, color: ui.color, width: ui.width / zoom };
    gesture.current = g;
    setLive({ points: g.points, color: g.color, width: g.width });
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.pid !== e.pointerId) return;
    if (g.kind === "pan") {
      void rf.setViewport({ x: g.vp.x + e.clientX - g.start.x, y: g.vp.y + e.clientY - g.start.y, zoom: g.vp.zoom });
    } else if (g.kind === "erase") {
      eraseAt(e, g.ids);
    } else {
      // con lápiz/mouse rápido llegan varios puntos por cuadro: se usan todos
      const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
      for (const ev of events) {
        if (Math.hypot(ev.clientX - g.lastScreen.x, ev.clientY - g.lastScreen.y) < 1.5) continue;
        const p = rf.screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
        g.points.push(p.x, p.y);
        g.lastScreen = { x: ev.clientX, y: ev.clientY };
      }
      setLive({ points: [...g.points], color: g.color, width: g.width });
    }
  };

  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.pid !== e.pointerId) return;
    gesture.current = null;
    if (g.kind === "erase") {
      // toda la pasada de goma es un solo paso para Ctrl Z
      if (g.ids.size) useMindMap.getState().removeStrokes([...g.ids]);
      setErasing(new Set());
    } else if (g.kind === "draw") {
      const zoom = rf.getViewport().zoom;
      const points = simplify(g.points, 0.6 / zoom);
      if (points.length > 6000) points.length = 6000;
      useMindMap.getState().addStroke({ id: nanoid(10), color: g.color, width: Math.round(g.width * 100) / 100, points });
      setLive(null);
    }
  };

  return (
    <>
      <ViewportPortal>
        <svg className="mm-drawings" aria-hidden>
          <Drawings strokes={strokes} hidden={erasing} />
          {live && <path d={strokePath(live.points)} stroke={live.color} strokeWidth={live.width} />}
        </svg>
      </ViewportPortal>
      {tool && (
        <div
          ref={capture}
          className={`mm-draw-capture is-${tool}`}
          role="application"
          aria-label={tool === "pen" ? "Lienzo de dibujo: arrastrá para dibujar" : "Goma: pasá sobre un trazo para borrarlo"}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onContextMenu={(e) => e.preventDefault()}
        />
      )}
    </>
  );
}
