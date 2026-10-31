"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Maximize2, Minus, NotebookText, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { outwardOf, siblingAxis } from "../model/geometry";
import { IMG_PAD, measureNode, typographyFor } from "../model/measure";
import { accentOf } from "../model/palette";
import { depthOf, descendantsOf } from "../model/tree";
import type { Direction } from "../model/types";
import { useMindMap } from "../store/mindmap-store";
import { useNoteUi } from "../store/note-ui-store";

const ARROW = { left: ArrowLeft, right: ArrowRight, top: ArrowUp, bottom: ArrowDown } as const;

/** Posiciona un "slot" pegado al borde del nodo. El padding transparente actúa
 *  de puente para que el hover no se corte entre el nodo y el botón. */
function slotStyle(dir: Direction, gap: number): CSSProperties {
  switch (dir) {
    case "right":
      return { left: "100%", top: "50%", transform: "translateY(-50%)", paddingLeft: gap };
    case "left":
      return { right: "100%", top: "50%", transform: "translateY(-50%)", paddingRight: gap };
    case "top":
      return { bottom: "100%", left: "50%", transform: "translateX(-50%)", paddingBottom: gap };
    case "bottom":
      return { top: "100%", left: "50%", transform: "translateX(-50%)", paddingTop: gap };
  }
}

/** Pastilla de plegado: montada sobre el borde por donde salen las ramas. */
function collapseStyle(dir: Direction): CSSProperties {
  if (dir === "right") return { left: "calc(100% - 9px)", top: "50%", transform: "translateY(-50%)" };
  if (dir === "left") return { right: "calc(100% - 9px)", top: "50%", transform: "translateY(-50%)" };
  if (dir === "top") return { bottom: "calc(100% - 9px)", left: "50%", transform: "translateX(-50%)" };
  return { top: "calc(100% - 9px)", left: "50%", transform: "translateX(-50%)" };
}

/** Slot centrado sobre el borde (mitad adentro, mitad afuera): no invade al vecino. */
function straddleStyle(dir: Direction): CSSProperties {
  const base: CSSProperties = { transform: "translate(-50%, -50%)" };
  if (dir === "top") return { ...base, top: 0, left: "50%" };
  if (dir === "bottom") return { ...base, top: "100%", left: "50%" };
  if (dir === "left") return { ...base, left: 0, top: "50%" };
  return { ...base, left: "100%", top: "50%" };
}

const spring = { type: "spring", stiffness: 520, damping: 26 } as const;

/** Puntos de conexión en las 4 esquinas (los lados ya tienen los botones de agregar y plegar) */
const CONNECTORS: { id: string; position: Position; style: CSSProperties }[] = [
  { id: "c-tl", position: Position.Top, style: { left: 0, top: 0 } },
  { id: "c-tr", position: Position.Top, style: { left: "100%", top: 0 } },
  { id: "c-bl", position: Position.Bottom, style: { left: 0, top: "auto", bottom: 0 } },
  { id: "c-br", position: Position.Bottom, style: { left: "100%", top: "auto", bottom: 0 } },
];

function QuickAdd({ dir, gap, label, onClick, kind }: { dir: Direction; gap: number; label: string; onClick: () => void; kind: "child" | "sibling" }) {
  const Icon = ARROW[dir];
  return (
    <div className="absolute z-20" style={kind === "sibling" ? straddleStyle(dir) : slotStyle(dir, gap)}>
      <motion.button
        type="button"
        aria-label={label}
        title={label}
        className={`mm-quick nodrag nopan ${kind === "child" ? "mm-quick--child" : "mm-quick--sibling"}`}
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.3, opacity: 0 }}
        whileHover={{ scale: 1.18 }}
        whileTap={{ scale: 0.88 }}
        transition={spring}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <Icon size={kind === "child" ? 13 : 11} strokeWidth={2.4} />
      </motion.button>
    </div>
  );
}

function NodeEditor({ id, seed, depth, top }: { id: string; seed: string | null; depth: number; top: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const draft = useMindMap((s) => s.editDraft ?? "");
  const setDraft = useMindMap((s) => s.setDraft);
  const done = useRef(false);
  const typedEarly = useRef(false);

  // React Flow deja un nodo recién creado con visibility:hidden hasta medirlo,
  // y un elemento oculto no acepta foco: reintentamos cuadro a cuadro.
  useLayoutEffect(() => {
    let raf = 0;
    let tries = 0;
    const tryFocus = () => {
      const el = ref.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      if (document.activeElement === el) {
        if (seed || typedEarly.current) el.setSelectionRange(el.value.length, el.value.length);
        else el.select();
      } else if (tries++ < 30) {
        raf = requestAnimationFrame(tryFocus);
      }
    };
    tryFocus();
    return () => cancelAnimationFrame(raf);
  }, [seed]);

  // teclas que llegaron antes de que el textarea tuviera foco (las reenvía el hook global)
  useEffect(() => {
    const onType = (e: Event) => {
      const ch = (e as CustomEvent<string>).detail;
      const current = useMindMap.getState().editDraft ?? "";
      setDraft((typedEarly.current || seed ? current : "") + ch);
      typedEarly.current = true;
    };
    window.addEventListener("mm:type", onType);
    return () => window.removeEventListener("mm:type", onType);
  }, [seed, setDraft]);

  const finish = (mode: "commit" | "cancel") => {
    if (done.current) return;
    done.current = true;
    const s = useMindMap.getState();
    if (mode === "cancel") s.cancelEdit();
    else s.commitEdit(id, s.editDraft ?? "");
  };

  const t = typographyFor(depth);
  return (
    <textarea
      ref={ref}
      value={draft}
      rows={1}
      spellCheck={false}
      aria-label="Texto del nodo"
      className="mm-editor nodrag nopan nowheel"
      placeholder={top ? "Texto (opcional)" : undefined}
      style={{ ...(top ? { top, height: `calc(100% - ${top}px)` } : null), fontFamily: t.fontFamily, fontSize: t.fontSize, fontWeight: t.fontWeight, lineHeight: `${t.lineHeight}px`, padding: `${t.padY}px ${t.padX}px` }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish("commit")}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          finish("commit");
        } else if (e.key === "Tab") {
          e.preventDefault();
          finish("commit");
          useMindMap.getState().addChild(id);
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish("cancel");
        }
      }}
    />
  );
}

function MindNodeImpl({ id }: NodeProps) {
  const node = useMindMap((s) => s.nodes[id]);
  const depth = useMindMap((s) => depthOf(s.nodes, id));
  const isRoot = useMindMap((s) => s.rootId === id);
  const selected = useMindMap((s) => s.selectedId === id);
  const editing = useMindMap((s) => s.editingId === id);
  const editSeed = useMindMap((s) => (s.editingId === id ? s.editSeed : null));
  const dragging = useMindMap((s) => s.dragging);
  const mode = useMindMap((s) => s.layoutMode);
  const outward = useMindMap((s) => (s.nodes[id] ? outwardOf(s.nodes, s.rootId, id, s.layoutMode) : "right"));
  const hiddenCount = useMindMap((s) => (s.nodes[id]?.collapsed ? descendantsOf(s.nodes, id).length : 0));
  useMindMap((s) => s.fontEpoch); // re-render cuando cambian las medidas
  const draft = useMindMap((s) => (s.editingId === id ? s.editDraft : null));
  const [hover, setHover] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Si la idea se mueve (animación de layout) y deja de estar bajo el cursor, el
  // navegador no avisa "mouseleave": se verifica con el próximo movimiento del mouse.
  useEffect(() => {
    if (!hover) return;
    const check = (e: PointerEvent) => {
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) {
        setHover(false);
        if (useNoteUi.getState().hoverId === id) useNoteUi.getState().setHover(null);
      }
    };
    window.addEventListener("pointermove", check, { passive: true });
    return () => window.removeEventListener("pointermove", check);
  }, [hover, id]);

  if (!node) return null;

  const accent = accentOf(node.color, isRoot);
  const t = typographyFor(depth);
  const committed = measureNode(node.text, depth, node.image);
  // al escribir en una idea con imagen siempre hay lugar para el texto, aunque esté vacío
  const size = draft === null ? committed : measureNode(node.image && !draft.trim() ? "Mm" : draft, depth, node.image);
  const imgTop = size.image ? size.image.height + IMG_PAD : 0;
  const isFloatingRoot = !!node.floating && !node.parentId;
  // Mientras se edita, el nodo crece alejándose de su padre (y centrado en el eje
  // perpendicular), para no tapar la rama de la que cuelga.
  const dw = size.width - committed.width;
  const dh = size.height - committed.height;
  const growX = isRoot || mode === "tree" ? -dw / 2 : outward === "left" ? -dw : outward === "right" ? 0 : -dw / 2;
  const growY = mode === "tree" ? 0 : outward === "top" ? -dh : outward === "bottom" ? 0 : -dh / 2;
  const showControls = (hover || selected) && !editing && !dragging;
  const hasChildren = node.children.length > 0;
  const sib = siblingAxis(outward);
  const s = useMindMap.getState;
  const multiline = size.lines > 1;
  const hasNote = !!node.note?.trim();
  const showConnectors = (hover || selected) && !editing && !dragging;

  const tier = isRoot ? "mm-node--root" : depth === 1 ? "mm-node--branch" : "mm-node--leaf";

  return (
    <div
      ref={wrapRef}
      className="relative"
      style={{ ["--accent" as string]: accent }}
      onMouseEnter={() => {
        setHover(true);
        useNoteUi.getState().setHover(id);
      }}
      onMouseLeave={() => {
        setHover(false);
        if (useNoteUi.getState().hoverId === id) useNoteUi.getState().setHover(null);
      }}
    >
      <Handle type="target" position={Position.Left} className="mm-handle" isConnectable={false} />
      <Handle type="source" position={Position.Right} className="mm-handle" isConnectable={false} />
      {/* Puntos de conexión (esquinas): se arrastran hasta otra idea para crear una flecha de relación */}
      {CONNECTORS.map((c) => (
        <Handle
          key={c.id}
          id={c.id}
          type="source"
          position={c.position}
          className={`mm-conn ${showConnectors ? "is-shown" : ""}`}
          style={c.style}
          title="Arrastrá hasta otra idea para relacionarlas"
          aria-label="Punto de conexión: arrastrá hasta otra idea para crear una relación"
        />
      ))}

      <motion.div
        className={`mm-node ${tier} ${selected ? "is-selected" : ""} ${editing ? "is-editing" : ""}`}
        style={{
          width: size.width,
          height: size.height,
          marginLeft: growX,
          marginTop: growY,
          // márgenes compensatorios: la caja externa conserva el tamaño confirmado
          marginRight: -(dw + growX),
          marginBottom: -(dh + growY),
          borderRadius: node.image ? 16 : isRoot ? 999 : multiline ? 18 : 999,
        }}
        initial={{ scale: 0.55, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 24 }}
      >
        {isRoot && <span className="mm-root-ring" aria-hidden />}
        {node.image && size.image && (
          <div
            className="mm-node-img"
            style={{ width: size.image.width, height: size.image.height, margin: `${IMG_PAD}px auto 0` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL guardada en el mapa */}
            <img src={node.image.src} alt={node.text ? `Imagen de ${node.text}` : "Imagen de la idea"} draggable={false} />
            {selected && !editing && (
              <div className="mm-img-tools">
                <button
                  type="button"
                  className="mm-img-btn nodrag nopan"
                  aria-label="Ver la imagen en grande"
                  title="Ver en grande"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    useNoteUi.getState().openImage(id);
                  }}
                >
                  <Maximize2 size={12} />
                </button>
                <button
                  type="button"
                  className="mm-img-btn nodrag nopan"
                  aria-label="Quitar la imagen"
                  title="Quitar imagen (Ctrl Z la recupera)"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    s().setImage(id, null);
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        )}
        {editing ? (
          <NodeEditor id={id} seed={editSeed} depth={depth} top={imgTop} />
        ) : node.image && !node.text.trim() ? null : (
          <div
            className="mm-label"
            style={{ fontFamily: t.fontFamily, fontSize: t.fontSize, fontWeight: t.fontWeight, lineHeight: `${t.lineHeight}px`, padding: `${t.padY}px ${t.padX}px` }}
          >
            {node.text}
          </div>
        )}
      </motion.div>

      {/* Marca de nota: la idea tiene apuntes. Clic = abrirla fijada.
          Para escribir una nota nueva: botón "Nota" de la barra o Ctrl Enter. */}
      {hasNote && !editing && (
        <button
          type="button"
          className="mm-note-badge nodrag nopan"
          aria-label="Abrir la nota de esta idea"
          title="Abrir nota (Ctrl Enter)"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            s().select(id);
            useNoteUi.getState().pin(id);
          }}
        >
          <NotebookText size={8} strokeWidth={2.6} />
        </button>
      )}

      {/* Plegar / desplegar: pegado al borde por donde salen las ramas */}
      {!isRoot && hasChildren && (node.collapsed || showControls) && (
        <div className="absolute z-30" style={collapseStyle(outward)}>
          <motion.button
            type="button"
            className="mm-collapse nodrag nopan"
            aria-label={node.collapsed ? `Mostrar ${hiddenCount} ideas ocultas` : "Plegar rama"}
            title={node.collapsed ? `Mostrar ${hiddenCount} ideas ocultas (/)` : "Plegar rama (/)"}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.9 }}
            transition={spring}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              s().select(id);
              s().toggleCollapse(id);
              if (e.detail > 0) e.currentTarget.blur();
            }}
          >
            {node.collapsed ? hiddenCount : <Minus size={10} strokeWidth={3} />}
          </motion.button>
        </div>
      )}

      <AnimatePresence>
        {showControls && (
          <>
            {isRoot && mode === "map" ? (
              <>
                <QuickAdd key="r" dir="right" gap={14} kind="child" label="Agregar rama a la derecha" onClick={() => s().addChild(id, "right")} />
                <QuickAdd key="l" dir="left" gap={14} kind="child" label="Agregar rama a la izquierda" onClick={() => s().addChild(id, "left")} />
              </>
            ) : (
              <QuickAdd key="c" dir={outward} gap={hasChildren && !isRoot ? 22 : 14} kind="child" label="Agregar idea hija (Tab)" onClick={() => s().addChild(id)} />
            )}
            {!isRoot && !isFloatingRoot && (
              <>
                <QuickAdd key="b" dir={sib.before} gap={6} kind="sibling" label="Agregar idea hermana antes (Shift+Enter)" onClick={() => s().addSibling(id, "before")} />
                <QuickAdd key="a" dir={sib.after} gap={6} kind="sibling" label="Agregar idea hermana (Enter)" onClick={() => s().addSibling(id, "after")} />
              </>
            )}
          </>
        )}
      </AnimatePresence>

    </div>
  );
}

export const MindNode = memo(MindNodeImpl);
