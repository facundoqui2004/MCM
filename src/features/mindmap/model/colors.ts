/**
 * Colores para pintar ideas y dibujar. Son fijos (no dependen del tema) porque
 * el usuario los elige para marcar algo: "lo de amarillo entra en el parcial".
 */

export const FILL_SWATCHES: { hex: string; name: string }[] = [
  { hex: "#fde68a", name: "Amarillo" },
  { hex: "#fed7aa", name: "Naranja" },
  { hex: "#fecaca", name: "Rojo" },
  { hex: "#fbcfe8", name: "Rosa" },
  { hex: "#ddd6fe", name: "Lila" },
  { hex: "#bfdbfe", name: "Celeste" },
  { hex: "#bbf7d0", name: "Verde" },
  { hex: "#e7e5e4", name: "Gris" },
  { hex: "#1e293b", name: "Negro" },
];

export const PEN_COLORS: { hex: string; name: string }[] = [
  { hex: "#e11d48", name: "Rojo" },
  { hex: "#f59e0b", name: "Amarillo" },
  { hex: "#16a34a", name: "Verde" },
  { hex: "#2563eb", name: "Azul" },
  { hex: "#7c3aed", name: "Violeta" },
  { hex: "#1f2937", name: "Negro" },
];

/** Grosor del lápiz en píxeles de pantalla (al guardarse se ajusta al zoom) */
export const PEN_WIDTHS = [2, 4, 8] as const;

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** Luminancia relativa (WCAG) de un #rrggbb */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** Texto legible sobre un relleno: oscuro sobre claros, blanco sobre oscuros */
export const inkOn = (hex: string) => (luminance(hex) > 0.36 ? "#1c1714" : "#ffffff");

/** Borde un poco más oscuro que el relleno, para que la idea no se pierda en el fondo */
export const borderFor = (hex: string) => `color-mix(in oklab, ${hex} 72%, #000)`;
