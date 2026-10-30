"use client";

import { useEffect, useState } from "react";
import { toOutline } from "../model/tree";
import { useMindMap } from "../store/mindmap-store";
import { useNoteUi } from "../store/note-ui-store";

const isTypingTarget = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

const isControl = (el: EventTarget | null) =>
  el instanceof HTMLElement && !!el.closest("button, a[href], [role='radio'], [role='button']");

/**
 * Atajos globales del editor. Mientras se edita un nodo, el textarea maneja sus
 * propias teclas (Enter confirma, Tab confirma y crea hijo, Esc cancela).
 */
export function useKeyboardShortcuts({ onSave, onFind }: { onSave: () => void; onFind: () => void }) {
  const [spaceHeld, setSpaceHeld] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTypingTarget(e.target)) setSpaceHeld(true);
      const s = useMindMap.getState();
      // El editor del nodo nuevo puede tardar 1-2 cuadros en tomar foco: no perder lo tipeado
      if (s.editingId && !isTypingTarget(e.target) && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("mm:type", { detail: e.key }));
        return;
      }
      if (s.editingId || isTypingTarget(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const sel = s.selectedId;

      // Con una flecha de relación seleccionada: Supr la borra, F2/Enter la nombra, Esc la suelta
      const rel = s.selectedRelationId;
      if (rel && !mod && !e.altKey && !isControl(e.target)) {
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          s.deleteRelation(rel);
          return;
        }
        if (e.key === "F2" || e.key === "Enter") {
          e.preventDefault();
          s.startRelationEdit(rel);
          return;
        }
        if (e.key === "Escape") {
          s.selectRelation(null);
          return;
        }
      }

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        s.redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSave();
        return;
      }
      if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        onFind();
        return;
      }
      // Ctrl Enter: abre (fija) la nota de la idea seleccionada para escribir en ella
      if (mod && e.key === "Enter" && sel) {
        e.preventDefault();
        useNoteUi.getState().pin(sel);
        return;
      }
      // Ctrl C sobre una idea: copia la rama como lista con sangría (para pegar en apuntes).
      // Si hay texto seleccionado en la página, se respeta la copia normal del navegador.
      if (mod && e.key.toLowerCase() === "c" && sel && !window.getSelection()?.toString()) {
        e.preventDefault();
        const text = toOutline(s.nodes, sel);
        const count = text.split("\n").length;
        navigator.clipboard?.writeText(text).then(
          () => s.notify(count === 1 ? "Idea copiada" : `Rama copiada: ${count} ideas como lista`),
          () => s.notify("El navegador no dejó copiar. Probá de nuevo con la pestaña en primer plano"),
        );
        return;
      }
      if (mod || e.altKey) return;

      // Con el foco en un botón o link, Tab/Enter/flechas hacen lo nativo
      // (navegar la interfaz, activar el botón), no crean ideas.
      if (isControl(e.target)) return;

      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        s.collapseAll();
        return;
      }
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        s.expandLevel();
        return;
      }

      if (!sel) {
        // Sin selección, Tab recorre la interfaz normalmente (no hay trampa de foco).
        // Flechas o Enter devuelven al mapa seleccionando la idea central.
        if (["Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
          e.preventDefault();
          s.select(s.rootId);
        }
        return;
      }
      switch (e.key) {
        case "Tab":
          e.preventDefault();
          s.addChild(sel);
          return;
        case "Enter":
          e.preventDefault();
          s.addSibling(sel, e.shiftKey ? "before" : "after");
          return;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          s.deleteNode(sel);
          return;
        case "F2":
          e.preventDefault();
          s.startEdit(sel);
          return;
        case "/":
          e.preventDefault();
          s.toggleCollapse(sel);
          return;
        case "Escape":
          s.select(null);
          return;
        case "ArrowLeft":
        case "ArrowRight":
        case "ArrowUp":
        case "ArrowDown": {
          e.preventDefault();
          const map = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "top", ArrowDown: "bottom" } as const;
          s.navigate(map[e.key]);
          return;
        }
      }
      // Tipear un carácter sobre un nodo seleccionado reemplaza su texto (como XMind)
      if (e.key.length === 1 && e.key !== " ") {
        e.preventDefault();
        s.startEdit(sel, e.key);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    const blur = () => setSpaceHeld(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [onSave, onFind]);

  return { spaceHeld };
}
