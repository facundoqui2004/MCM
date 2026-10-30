/**
 * Medición de texto sincrónica con Canvas 2D.
 *
 * El layout necesita el tamaño de cada nodo ANTES de que React lo pinte (si no,
 * habría que esperar al ResizeObserver y re-layoutear, con saltos visibles).
 * Medimos con la misma fuente, tamaño y padding que usa el CSS del nodo, y el
 * componente fija width/height con este resultado: layout y render coinciden.
 */

export const MAX_TEXT_WIDTH = 240;

export interface NodeTypography {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  padX: number;
  padY: number;
  minWidth: number;
}

const UI_FONT = `"Instrument Sans", ui-sans-serif, system-ui, sans-serif`;
const DISPLAY_FONT = `"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif`;

export function typographyFor(depth: number): NodeTypography {
  if (depth === 0)
    return { fontFamily: DISPLAY_FONT, fontSize: 20, fontWeight: 650, lineHeight: 26, padX: 26, padY: 16, minWidth: 120 };
  if (depth === 1)
    return { fontFamily: UI_FONT, fontSize: 15, fontWeight: 600, lineHeight: 20, padX: 18, padY: 10, minWidth: 64 };
  return { fontFamily: UI_FONT, fontSize: 14, fontWeight: 500, lineHeight: 19, padX: 15, padY: 8, minWidth: 48 };
}

export interface NodeSize {
  width: number;
  height: number;
  lines: number;
}

let ctx: CanvasRenderingContext2D | null = null;
const cache = new Map<string, NodeSize>();

function context(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!ctx) ctx = document.createElement("canvas").getContext("2d");
  return ctx;
}

function textWidth(text: string, t: NodeTypography): number {
  const c = context();
  if (!c) return text.length * t.fontSize * 0.56; // fallback SSR
  c.font = `${t.fontWeight} ${t.fontSize}px ${t.fontFamily}`;
  return c.measureText(text).width;
}

/** Envuelve por palabras igual que `white-space: pre-wrap; overflow-wrap: anywhere`. */
function wrap(text: string, t: NodeTypography): { widest: number; lines: number } {
  const paragraphs = text.split("\n");
  let widest = 0;
  let lines = 0;
  const space = textWidth(" ", t);
  for (const p of paragraphs) {
    const words = p.split(" ");
    let line = 0;
    lines += 1;
    for (const w of words) {
      const ww = textWidth(w, t);
      const next = line === 0 ? ww : line + space + ww;
      if (next > MAX_TEXT_WIDTH && line > 0) {
        widest = Math.max(widest, line);
        lines += 1 + Math.floor(ww / MAX_TEXT_WIDTH);
        line = Math.min(ww, MAX_TEXT_WIDTH);
      } else if (next > MAX_TEXT_WIDTH) {
        lines += Math.floor(ww / MAX_TEXT_WIDTH);
        line = MAX_TEXT_WIDTH;
      } else {
        line = next;
      }
    }
    widest = Math.max(widest, line);
  }
  return { widest: Math.min(widest, MAX_TEXT_WIDTH), lines };
}

export function measureNode(text: string, depth: number): NodeSize {
  const key = `${Math.min(depth, 2)}|${text}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const t = typographyFor(depth);
  const { widest, lines } = wrap(text || " ", t);
  const size: NodeSize = {
    width: Math.ceil(Math.max(t.minWidth, widest + t.padX * 2 + 2)),
    height: Math.ceil(lines * t.lineHeight + t.padY * 2 + 2),
    lines,
  };
  if (context()) cache.set(key, size);
  return size;
}

/** Se llama cuando cargan las webfonts: las medidas con la fuente fallback quedan obsoletas. */
export function clearMeasureCache() {
  cache.clear();
}
