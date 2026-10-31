"use client";

import { create } from "zustand";
import type { XY } from "../model/types";

/**
 * Estado de interfaz de las notas (no se guarda en la base):
 * qué idea tiene el cursor encima y qué ventanas de nota están fijadas.
 */

export interface PinnedNote {
  id: string;
  /** Posición en pantalla (px, position: fixed) */
  pos: XY;
  /** Orden de apilado: la última tocada queda arriba */
  z: number;
  /** Lo que se tecleó antes de que el textarea tuviera foco no se pierde */
  focusOnOpen: boolean;
}

interface NoteUiState {
  hoverId: string | null;
  pinned: PinnedNote[];
  setHover: (id: string | null) => void;
  pin: (id: string, pos?: XY) => void;
  unpin: (id: string) => void;
  raise: (id: string) => void;
  move: (id: string, pos: XY) => void;
  consumeFocus: (id: string) => void;
  /** Idea cuya imagen se está viendo en grande */
  imageId: string | null;
  openImage: (id: string | null) => void;
}

const MAX_PINNED = 4;
let zCounter = 1;

/** Si no se indica posición, las ventanas se escalonan desde arriba a la derecha */
function defaultPos(index: number): XY {
  const w = typeof window === "undefined" ? 1280 : window.innerWidth;
  const width = Math.min(380, w - 16);
  return { x: Math.max(8, w - width - 24 - index * 28), y: 76 + index * 28 };
}

export const useNoteUi = create<NoteUiState>()((set, get) => ({
  hoverId: null,
  pinned: [],
  setHover: (hoverId) => set({ hoverId }),
  pin: (id, pos) => {
    const s = get();
    const existing = s.pinned.find((p) => p.id === id);
    if (existing) {
      set({ pinned: s.pinned.map((p) => (p.id === id ? { ...p, z: ++zCounter, focusOnOpen: true } : p)), hoverId: null });
      return;
    }
    // si ya hay muchas abiertas, se cierra la más vieja (la de más abajo en la pila)
    let list = s.pinned;
    if (list.length >= MAX_PINNED) list = [...list].sort((a, b) => a.z - b.z).slice(1);
    set({
      pinned: [...list, { id, pos: pos ?? defaultPos(list.length), z: ++zCounter, focusOnOpen: true }],
      hoverId: null,
    });
  },
  unpin: (id) => set({ pinned: get().pinned.filter((p) => p.id !== id) }),
  raise: (id) => set({ pinned: get().pinned.map((p) => (p.id === id ? { ...p, z: ++zCounter } : p)) }),
  move: (id, pos) => set({ pinned: get().pinned.map((p) => (p.id === id ? { ...p, pos } : p)) }),
  imageId: null,
  openImage: (imageId) => set({ imageId }),
  consumeFocus: (id) => set({ pinned: get().pinned.map((p) => (p.id === id ? { ...p, focusOnOpen: false } : p)) }),
}));
