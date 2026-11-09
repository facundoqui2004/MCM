"use client";

import { create } from "zustand";
import { PEN_COLORS, PEN_WIDTHS } from "../model/colors";

/**
 * Estado del lápiz (no se guarda en el mapa): herramienta activa, color y
 * grosor. Lo dibujado sí se guarda, en doc.drawings.
 */
export type DrawTool = "pen" | "eraser";

interface DrawUiState {
  tool: DrawTool | null;
  color: string;
  width: number;
  setTool: (tool: DrawTool | null) => void;
  setColor: (color: string) => void;
  setWidth: (width: number) => void;
}

export const useDrawUi = create<DrawUiState>()((set) => ({
  tool: null,
  color: PEN_COLORS[0].hex,
  width: PEN_WIDTHS[1],
  setTool: (tool) => set({ tool }),
  // elegir color o grosor vuelve al lápiz (si estaba la goma)
  setColor: (color) => set((s) => ({ color, tool: s.tool ? "pen" : s.tool })),
  setWidth: (width) => set((s) => ({ width, tool: s.tool ? "pen" : s.tool })),
}));
