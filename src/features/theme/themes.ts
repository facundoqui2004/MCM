export type ThemeId = "paper" | "grid" | "lavender" | "minimal" | "studio";

export interface ThemeDef {
  id: ThemeId;
  name: string;
  description: string;
  /** Fondo del lienzo: puntos, cuadrícula o liso */
  background: "dots" | "lines" | "none";
  gap: number;
  dotSize: number;
  /** Muestra para el selector (fondo + borde de la idea central) */
  swatch: { bg: string; ring: string };
}

export const DEFAULT_THEME: ThemeId = "paper";
export const THEME_STORAGE_KEY = "mm-theme";

export const THEMES: ThemeDef[] = [
  { id: "paper", name: "Papel", description: "Crema con puntos, acento coral", background: "dots", gap: 20, dotSize: 1.7, swatch: { bg: "#fdf6ec", ring: "linear-gradient(135deg,#e5764d,#f2a65a)" } },
  { id: "grid", name: "Cuaderno", description: "Celeste cuadriculado", background: "lines", gap: 24, dotSize: 1, swatch: { bg: "#eef4fc", ring: "linear-gradient(120deg,#4a8fe2,#8f6ae8)" } },
  { id: "lavender", name: "Lavanda", description: "Lila con puntos, borde rosa", background: "dots", gap: 16, dotSize: 1.7, swatch: { bg: "#ece9f1", ring: "linear-gradient(110deg,#ee4f8b,#f7a46b)" } },
  { id: "minimal", name: "Minimal", description: "Gris liso, sin distracciones", background: "none", gap: 20, dotSize: 1, swatch: { bg: "#f1f2f4", ring: "linear-gradient(120deg,#1f3d5c,#2a8f9c)" } },
  { id: "studio", name: "Estudio oscuro", description: "El tema oscuro original", background: "dots", gap: 22, dotSize: 1.3, swatch: { bg: "#0d0f12", ring: "conic-gradient(#a78bfa,#22d3ee,#34d399,#fbbf24,#fb7185,#a78bfa)" } },
];

export const isThemeId = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);

/**
 * Script en línea para <head>: aplica el tema guardado antes del primer pintado
 * (sin él, la página parpadea con el tema por defecto al recargar).
 */
export const themeBootScript = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(${JSON.stringify(THEMES.map((t) => t.id))}.indexOf(t)<0)t="${DEFAULT_THEME}";document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="${DEFAULT_THEME}";}`;
