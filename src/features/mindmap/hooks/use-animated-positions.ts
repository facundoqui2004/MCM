"use client";

import { animate } from "motion";
import { useLayoutEffect, useReducer, useRef } from "react";
import type { XY } from "../model/types";

/**
 * Interpola las posiciones que muestra React Flow hacia las del store con un
 * resorte de Motion. Animamos en JS (no con transition CSS) para que los bordes,
 * que leen la posición interna de React Flow, sigan a los nodos cuadro a cuadro.
 *
 * - Nodos nuevos nacen desde `spawnFrom(id)` (la posición actual del padre).
 * - Con `instant` (durante un drag) se aplican sin animar.
 */
export function useAnimatedPositions(
  targets: Record<string, XY>,
  { instant, spawnFrom }: { instant: boolean; spawnFrom: (id: string) => XY | undefined },
): Record<string, XY> {
  const shown = useRef<Record<string, XY>>({});
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const spawnRef = useRef(spawnFrom);
  spawnRef.current = spawnFrom;

  useLayoutEffect(() => {
    const from: Record<string, XY> = {};
    for (const id of Object.keys(targets)) {
      from[id] = shown.current[id] ?? spawnRef.current(id) ?? targets[id];
    }
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (instant || reduce) {
      shown.current = targets;
      rerender();
      return;
    }
    shown.current = from;
    const controls = animate(0, 1, {
      type: "spring",
      stiffness: 320,
      damping: 30,
      mass: 0.9,
      onUpdate: (t) => {
        const next: Record<string, XY> = {};
        for (const id of Object.keys(targets)) {
          const a = from[id];
          const b = targets[id];
          next[id] = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        }
        shown.current = next;
        rerender();
      },
    });
    return () => controls.stop();
  }, [targets, instant]);

  // primer render: lo no animado todavía se muestra en su punto de partida
  const out: Record<string, XY> = {};
  for (const id of Object.keys(targets)) out[id] = shown.current[id] ?? spawnFrom(id) ?? targets[id];
  return out;
}
