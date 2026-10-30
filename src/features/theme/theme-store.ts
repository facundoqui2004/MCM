"use client";

import { create } from "zustand";
import { DEFAULT_THEME, isThemeId, THEME_STORAGE_KEY, type ThemeId } from "./themes";

interface ThemeState {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
}

/**
 * El estado arranca SIEMPRE en el tema por defecto, igual que el HTML del
 * servidor: si el primer render del cliente usara el tema guardado, React
 * detectaría una diferencia de hidratación y re-renderizaría todo.
 * <ThemeSync /> lo alinea con el atributo que puso el script de <head>.
 */
export const useTheme = create<ThemeState>()((set) => ({
  theme: DEFAULT_THEME,
  setTheme: (theme) => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* navegación privada: el tema vale sólo para esta visita */
    }
    set({ theme });
  },
}));

export function readDocumentTheme(): ThemeId {
  const t = document.documentElement.dataset.theme;
  return isThemeId(t) ? t : DEFAULT_THEME;
}
