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
  /** Caja de la imagen dentro de la idea (si tiene) */
  image?: { width: number; height: number };
}

/** La imagen se muestra a lo sumo de este tamaño dentro de la idea (en el lienzo) */
export const IMG_MAX_W = 220;
export const IMG_MAX_H = 170;
/** margen alrededor de la imagen dentro de la idea */
export const IMG_PAD = 6;

export function imageBox(img: { w: number; h: number }) {
  const scale = Math.min(1, IMG_MAX_W / img.w, IMG_MAX_H / img.h);
  return { width: Math.max(24, Math.round(img.w * scale)), height: Math.max(24, Math.round(img.h * scale)) };
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

/**
 * Tamaño de una idea. Con imagen: la imagen va arriba y el texto debajo
 * (si no hay texto, la idea es sólo la imagen con su margen).
 */
export function measureNode(text: string, depth: number, image?: { w: number; h: number }, bold = false): NodeSize {
  if (!image) return measureText(text, depth, bold);
  const b = imageBox(image);
  if (!text.trim()) {
    return { width: b.width + IMG_PAD * 2 + 2, height: b.height + IMG_PAD * 2 + 2, lines: 0, image: b };
  }
  const t = measureText(text, depth, bold);
  return {
    width: Math.max(t.width, b.width + IMG_PAD * 2 + 2),
    height: t.height + b.height + IMG_PAD,
    lines: t.lines,
    image: b,
  };
}

/** Peso de la letra en negrita (más ancha: la idea crece para que el texto entre) */
export const BOLD_WEIGHT = 780;

/** Tipografía de una idea, contando la negrita que le haya puesto el usuario */
export function typographyOf(depth: number, bold = false): NodeTypography {
  const t = typographyFor(depth);
  return bold ? { ...t, fontWeight: Math.max(t.fontWeight, BOLD_WEIGHT) } : t;
}

function measureText(text: string, depth: number, bold = false): NodeSize {
  const key = `${Math.min(depth, 2)}|${bold ? "b" : ""}|${text}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const t = typographyOf(depth, bold);
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
