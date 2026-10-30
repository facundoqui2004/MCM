"use client";

import { useReactFlow } from "@xyflow/react";
import {
  AlignHorizontalDistributeCenter,
  ChevronsDownUp,
  ChevronsUpDown,
  CornerDownRight,
  GitFork,
  ListPlus,
  Network,
  Orbit,
  Redo2,
  Scan,
  NotebookText,
  Trash2,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { boundsOf } from "../model/geometry";
import type { LayoutMode } from "../model/types";
import { visibleIds } from "../model/tree";
import { useMindMap } from "../store/mindmap-store";
import { useNoteUi } from "../store/note-ui-store";

const spring = { type: "spring", stiffness: 500, damping: 22 } as const;

function DockButton({
  icon: Icon,
  label,
  text,
  keys,
  onClick,
  disabled,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  /** Texto visible junto al ícono (sólo para las acciones principales) */
  text?: string;
  keys?: string;
  onClick: () => void;
  /** Si viene un texto, el botón está apagado y el tooltip explica por qué */
  disabled?: string | false;
  danger?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
      <motion.button
        type="button"
        aria-label={keys ? `${label} (${keys})` : label}
        aria-disabled={disabled ? true : undefined}
        aria-description={disabled || undefined}
        onClick={(e) => {
          if (disabled) return;
          onClick();
          // con mouse, devolvemos el teclado al mapa (Tab/Enter siguen creando ideas);
          // con teclado (detail === 0) el foco se queda en el botón
          if (e.detail > 0) e.currentTarget.blur();
        }}
        className={`mm-dock-btn ${text ? "has-text" : ""} ${danger ? "is-danger" : ""} ${disabled ? "is-disabled" : ""}`}
        whileHover={disabled ? undefined : { scale: 1.08, y: -2 }}
        whileTap={disabled ? undefined : { scale: 0.92 }}
        transition={spring}
      >
        <Icon size={17} strokeWidth={1.9} />
        {text && <span className="mm-dock-text">{text}</span>}
      </motion.button>
      <AnimatePresence>
        {hover && (
          <motion.div
            className="mm-tip"
            role="tooltip"
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.14 }}
          >
            {disabled ? (
              <span className="mm-tip-reason">{disabled}</span>
            ) : (
              <>
                {label}
                {keys && <kbd>{keys}</kbd>}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const LAYOUTS: { mode: LayoutMode; label: string; icon: LucideIcon }[] = [
  { mode: "map", label: "Mapa", icon: GitFork },
  { mode: "tree", label: "Árbol", icon: Network },
  { mode: "radial", label: "Radial", icon: Orbit },
];

export function Dock() {
  const rf = useReactFlow();
  const selectedId = useMindMap((s) => s.selectedId);
  const rootId = useMindMap((s) => s.rootId);
  const layoutMode = useMindMap((s) => s.layoutMode);
  const autoLayout = useMindMap((s) => s.autoLayout);
  const canUndo = useMindMap((s) => s.past.length > 0);
  const canRedo = useMindMap((s) => s.future.length > 0);
  const hasBranches = useMindMap((s) => Object.values(s.nodes).some((n) => n.id !== s.rootId && n.children.length > 0));
  const anyCollapsed = useMindMap((s) => Object.values(s.nodes).some((n) => n.collapsed && n.children.length > 0));
  const s = useMindMap.getState;

  /** Encuadra usando las posiciones destino del store, no las animadas. */
  const frame = () =>
    requestAnimationFrame(() => {
      const st = s();
      const b = boundsOf(st.nodes, visibleIds(st.nodes, st.rootId));
      rf.fitBounds(b, { padding: 0.28, duration: 520 });
    });

  return (
    <motion.nav
      aria-label="Herramientas del mapa"
      className="mm-dock"
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.15 }}
    >
      <div className="mm-dock-group" role="group" aria-label="Crear y borrar">
        <DockButton icon={CornerDownRight} label="Agregar idea hija" text="Hija" keys="Tab" disabled={!selectedId && "Seleccioná una idea primero"} onClick={() => selectedId && s().addChild(selectedId)} />
        <DockButton icon={ListPlus} label="Agregar idea hermana" text="Hermana" keys="Enter" disabled={!selectedId && "Seleccioná una idea primero"} onClick={() => selectedId && s().addSibling(selectedId)} />
        <DockButton icon={NotebookText} label="Nota de la idea" text="Nota" keys="Ctrl Enter" disabled={!selectedId && "Seleccioná una idea primero"} onClick={() => selectedId && useNoteUi.getState().pin(selectedId)} />
        <DockButton icon={Trash2} label="Borrar idea y su rama" keys="Supr" danger disabled={!selectedId ? "Seleccioná una idea primero" : selectedId === rootId && "La idea central no se borra"} onClick={() => selectedId && s().deleteNode(selectedId)} />
      </div>

      <div className="mm-dock-sep" />

      <div className="mm-segment" role="radiogroup" aria-label="Distribución">
        {LAYOUTS.map(({ mode, label, icon: Icon }) => {
          const on = layoutMode === mode;
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={label}
              className={`mm-segment-btn ${on ? "is-on" : ""}`}
              onClick={(e) => {
                s().setLayoutMode(mode);
                frame();
                if (e.detail > 0) e.currentTarget.blur();
              }}
            >
              {on && <motion.span layoutId="mm-seg" className="mm-segment-pill" transition={spring} />}
              <Icon size={15} strokeWidth={2} className="relative" />
              <span className="relative mm-segment-text">{label}</span>
            </button>
          );
        })}
      </div>
      <span className="mm-dock-optional">
      <DockButton
        icon={AlignHorizontalDistributeCenter}
        label={autoLayout ? "Reordenar y encuadrar" : "Reordenar (deshace las posiciones que moviste a mano)"}
        onClick={() => {
          s().tidy();
          frame();
        }}
      />
      </span>

      <div className="mm-dock-sep" />

      <div className="mm-dock-group" role="group" aria-label="Plegado para repasar">
        <DockButton icon={ChevronsDownUp} label="Plegar todo" keys="-" disabled={!hasBranches && "Todavía no hay ramas con ideas adentro"} onClick={() => s().collapseAll()} />
        <DockButton icon={ChevronsUpDown} label="Desplegar un nivel" keys="+" disabled={!anyCollapsed && "No hay ramas plegadas"} onClick={() => s().expandLevel()} />
      </div>

      <div className="mm-dock-sep" />

      <div className="mm-dock-group" role="group" aria-label="Historial">
        <DockButton icon={Undo2} label="Deshacer" keys="Ctrl Z" disabled={!canUndo && "No hay nada para deshacer"} onClick={() => s().undo()} />
        <span className="mm-dock-optional">
        <DockButton icon={Redo2} label="Rehacer" keys="Ctrl Shift Z" disabled={!canRedo && "No hay nada para rehacer"} onClick={() => s().redo()} />
        </span>
      </div>

      <div className="mm-dock-sep mm-dock-optional" />

      <div className="mm-dock-group mm-dock-optional">
        <DockButton icon={Scan} label="Encuadrar todo el mapa" onClick={frame} />
      </div>
    </motion.nav>
  );
}
