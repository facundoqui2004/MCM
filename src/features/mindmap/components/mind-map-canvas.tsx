"use client";

import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  ReactFlow,
  useReactFlow,
  useViewport,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { centerOf } from "../model/geometry";
import { ImageError, fileToNodeImage, imageFileFrom } from "../model/image";
import { measureNode } from "../model/measure";
import { floatingRoots } from "../model/tree";
import type { XY } from "../model/types";
import { useAnimatedPositions } from "../hooks/use-animated-positions";
import { useMindMap } from "../store/mindmap-store";
import { useTheme } from "@/features/theme/theme-store";
import { THEMES } from "@/features/theme/themes";
import { BranchEdge } from "./branch-edge";
import { DrawLayer } from "./draw-layer";
import { MindNode } from "./mind-node";
import { RelationEdge } from "./relation-edge";

const nodeTypes = { mind: MindNode };
const edgeTypes = { branch: BranchEdge, relation: RelationEdge };

/** La idea que está bajo el puntero (para soltar la flecha en cualquier parte de la idea, no solo en un punto) */
function nodeUnderPointer(e: MouseEvent | TouchEvent): string | null {
  const p = "changedTouches" in e ? e.changedTouches[0] : e;
  if (!p) return null;
  const el = document.elementFromPoint(p.clientX, p.clientY)?.closest<HTMLElement>(".react-flow__node");
  return el?.dataset.id ?? null;
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/**
 * Pone una imagen en una idea o, si no hay idea de destino, crea una idea
 * flotante con la imagen en `at` (centro, en coordenadas del lienzo).
 */
export async function placeImage(file: Blob, target: { nodeId?: string | null; at?: XY }) {
  const s = useMindMap.getState();
  try {
    const img = await fileToNodeImage(file);
    if (target.nodeId && s.nodes[target.nodeId]) {
      if (s.setImage(target.nodeId, img)) s.notify("Imagen agregada · Ctrl Z para quitarla");
    } else if (target.at) {
      const sz = measureNode("", 1, img);
      s.addFloating({ x: target.at.x - sz.width / 2, y: target.at.y - sz.height / 2 }, { image: img });
    }
  } catch (err) {
    s.notify(err instanceof ImageError ? err.message : "No se pudo agregar la imagen");
  }
}

/** Textos accesibles de React Flow en español (por defecto vienen en inglés). */
const ariaLabels = {
  "node.a11yDescription.default": "Idea del mapa. Usá las flechas para moverte entre ideas.",
  "node.a11yDescription.keyboardDisabled": "Idea del mapa. Usá las flechas para moverte entre ideas.",
  "edge.a11yDescription.default": "Conexión entre dos ideas.",
};

/** En pantallas angostas el mapa entero queda ilegible: arrancamos centrados en la raíz. */
const NARROW = 720;
const NARROW_ZOOM = 0.85;

/** Halo de color que se desplaza con parallax al panear: da profundidad al lienzo. */
function CanvasAura() {
  const { x, y, zoom } = useViewport();
  const px = x * 0.06;
  const py = y * 0.06;
  return (
    <div
      aria-hidden
      className="mm-aura"
      style={{
        backgroundPosition: `${px}px ${py}px, ${-px * 0.7}px ${-py * 0.7}px, 0 0`,
        opacity: 0.55 + Math.min(zoom, 1.5) * 0.2,
      }}
    />
  );
}

export function MindMapCanvas({ spaceHeld }: { spaceHeld: boolean }) {
  const nodes = useMindMap((s) => s.nodes);
  const rootId = useMindMap((s) => s.rootId);
  const selectedId = useMindMap((s) => s.selectedId);
  const editingId = useMindMap((s) => s.editingId);
  const dragging = useMindMap((s) => s.dragging);
  const relations = useMindMap((s) => s.relations);
  const [connecting, setConnecting] = useState(false);
  const [dropping, setDropping] = useState(false);
  const theme = useTheme((s) => s.theme);
  const themeDef = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  const rf = useReactFlow();
  const wrapper = useRef<HTMLDivElement>(null);
  // se decide una vez al montar: en celular arrancamos legibles, no con todo el mapa en miniatura
  const [narrow] = useState(() => typeof window !== "undefined" && window.innerWidth < NARROW);

  // Medidas reales que reporta React Flow (las necesita para los bordes)
  const measured = useRef(new Map<string, { width: number; height: number }>());
  const [, bump] = useReducer((x: number) => x + 1, 0);

  const { ids, depths } = useMemo(() => {
    const ids: string[] = [];
    const depths: Record<string, number> = {};
    const walk = (id: string, d: number) => {
      const n = nodes[id];
      if (!n) return;
      ids.push(id);
      depths[id] = d;
      if (!n.collapsed) n.children.forEach((c) => walk(c, d + 1));
    };
    walk(rootId, 0);
    // ideas flotantes: cada una con su propio árbol
    for (const f of floatingRoots(nodes, rootId)) walk(f, 1);
    return { ids, depths };
  }, [nodes, rootId]);

  const targets = useMemo(() => {
    const out: Record<string, XY> = {};
    for (const id of ids) out[id] = { x: nodes[id].x, y: nodes[id].y };
    return out;
  }, [ids, nodes]);

  const lastShown = useRef<Record<string, XY>>({});
  const spawnFrom = useCallback(
    (id: string) => {
      const p = nodes[id]?.parentId;
      return p ? lastShown.current[p] : undefined;
    },
    [nodes],
  );
  const shown = useAnimatedPositions(targets, { instant: dragging, spawnFrom });
  lastShown.current = shown;

  const rfNodes: Node[] = ids.map((id) => ({
    id,
    type: "mind",
    position: shown[id],
    data: {},
    draggable: editingId !== id,
    zIndex: id === selectedId ? 20 : 10 - Math.min(depths[id], 9),
    // Hasta que React Flow mida el DOM, le damos nuestra medida (es exacta): así no
    // oculta el nodo recién creado y su editor puede tomar el foco en el mismo cuadro.
    measured: measured.current.get(id) ?? measureNode(nodes[id].text, depths[id], nodes[id].image, nodes[id].bold),
  }));

  const rfEdges: Edge[] = useMemo(() => {
    const visible = new Set(ids);
    const tree: Edge[] = ids
      .filter((id) => nodes[id].parentId)
      .map((id) => ({ id: `e-${id}`, source: nodes[id].parentId!, target: id, type: "branch", zIndex: 0 }));
    // las relaciones con un extremo dentro de una rama plegada no se dibujan (vuelven al desplegar)
    const rel: Edge[] = relations
      .filter((r) => visible.has(r.from) && visible.has(r.to))
      .map((r) => ({ id: `r-${r.id}`, source: r.from, target: r.to, type: "relation", zIndex: 1, data: { relId: r.id } }));
    return [...tree, ...rel];
  }, [ids, nodes, relations]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    let dims = false;
    for (const c of changes) {
      if (c.type === "dimensions" && c.dimensions) {
        measured.current.set(c.id, c.dimensions);
        dims = true;
      } else if (c.type === "position" && c.position && c.dragging) {
        useMindMap.getState().dragTo(c.id, c.position);
      }
    }
    if (dims) bump();
  }, []);

  // Pegar una imagen (Ctrl V): va a la idea elegida o, sin selección, a una idea flotante nueva
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      const file = imageFileFrom(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      const s = useMindMap.getState();
      const box = wrapper.current?.getBoundingClientRect();
      const at = box ? rf.screenToFlowPosition({ x: box.left + box.width / 2, y: box.top + box.height / 2 }) : { x: 0, y: 0 };
      void placeImage(file, { nodeId: s.selectedId, at });
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [rf]);

  // Mantener visible el nodo activo: si queda fuera de pantalla, centrarlo.
  useEffect(() => {
    if (!selectedId || !wrapper.current) return;
    const s = useMindMap.getState();
    if (!s.nodes[selectedId]) return;
    const c = centerOf(s.nodes, selectedId);
    const vp = rf.getViewport();
    const box = wrapper.current.getBoundingClientRect();
    const sx = c.x * vp.zoom + vp.x;
    const sy = c.y * vp.zoom + vp.y;
    const m = 90;
    if (sx < m || sy < m || sx > box.width - m || sy > box.height - 140) {
      rf.setCenter(c.x, c.y, { zoom: vp.zoom, duration: 420 });
    }
  }, [selectedId, nodes, rf]);

  return (
    <div
      ref={wrapper}
      className={`mm-canvas ${spaceHeld ? "is-panning" : ""} ${connecting ? "is-connecting" : ""} ${dropping ? "is-dropping" : ""}`}
      // Doble clic en el lienzo vacío: idea flotante en ese lugar
      onDoubleClick={(e) => {
        if (!(e.target as HTMLElement).classList.contains("react-flow__pane")) return;
        const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const sz = measureNode("Idea suelta", 1);
        useMindMap.getState().addFloating({ x: p.x - sz.width / 2, y: p.y - sz.height / 2 });
      }}
      // Arrastrar una imagen desde la compu: sobre una idea se la pone, en el vacío crea una flotante
      onDragOver={(e) => {
        if (!Array.from(e.dataTransfer.types).includes("Files")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        if (!dropping) setDropping(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as globalThis.Node | null)) setDropping(false);
      }}
      onDrop={(e) => {
        setDropping(false);
        const file = imageFileFrom(e.dataTransfer);
        if (!file) return;
        e.preventDefault();
        const el = (e.target as HTMLElement).closest<HTMLElement>(".react-flow__node");
        const at = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        void placeImage(file, { nodeId: el?.dataset.id ?? null, at });
      }}
      role="application"
      aria-roledescription="mapa mental"
      aria-label="Lienzo del mapa. Flechas para moverte, Tab para agregar una idea hija, Enter para una hermana, Esc para salir al resto de la interfaz."
    >
      <CanvasAura />
      <ReactFlow
        ariaLabelConfig={ariaLabels}
        onInit={(instance) => {
          if (!narrow) return;
          const s = useMindMap.getState();
          if (!s.nodes[s.rootId]) return;
          const c = centerOf(s.nodes, s.rootId);
          instance.setCenter(c.x, c.y, { zoom: NARROW_ZOOM });
        }}
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStart={(_, n) => {
          const s = useMindMap.getState();
          s.select(n.id);
          s.beginDrag();
        }}
        onNodeDragStop={() => useMindMap.getState().endDrag()}
        onNodeClick={(_, n) => useMindMap.getState().select(n.id)}
        onNodeDoubleClick={(_, n) => useMindMap.getState().startEdit(n.id)}
        onPaneClick={() => useMindMap.getState().select(null)}
        onEdgeClick={(_, e) => e.type === "relation" && useMindMap.getState().selectRelation((e.data as { relId: string }).relId)}
        onEdgeDoubleClick={(_, e) => e.type === "relation" && useMindMap.getState().startRelationEdit((e.data as { relId: string }).relId)}
        // Flechas de relación: se arrastran desde los puntos de las esquinas de una idea
        // y se sueltan sobre cualquier parte de otra idea.
        connectionMode={ConnectionMode.Loose}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={{ stroke: "var(--focus)", strokeWidth: 2, strokeDasharray: "6 5" }}
        connectionRadius={28}
        onConnectStart={() => setConnecting(true)}
        onConnect={(c) => {
          if (c.source && c.target) useMindMap.getState().addRelation(c.source, c.target);
        }}
        onConnectEnd={(e, state) => {
          setConnecting(false);
          if (state.isValid || !state.fromNode) return;
          const to = nodeUnderPointer(e);
          if (to && to !== state.fromNode.id) useMindMap.getState().addRelation(state.fromNode.id, to);
        }}
        nodeDragThreshold={3}
        fitView={!narrow}
        fitViewOptions={{ padding: 0.3, maxZoom: 1.05 }}
        minZoom={0.15}
        maxZoom={2.5}
        panActivationKeyCode="Space"
        zoomOnDoubleClick={false}
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        nodesConnectable
        elementsSelectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        disableKeyboardA11y
        colorMode={theme === "studio" ? "dark" : "light"}
        proOptions={{ hideAttribution: false }}
      >
        {themeDef.background !== "none" && (
          <Background
            key={themeDef.id}
            variant={themeDef.background === "lines" ? BackgroundVariant.Lines : BackgroundVariant.Dots}
            gap={themeDef.gap}
            size={themeDef.dotSize}
            lineWidth={1}
            color="var(--grid-color)"
          />
        )}
        <DrawLayer />
      </ReactFlow>
      {dropping && (
        <div className="mm-drop-hint" aria-hidden>
          Soltá la imagen sobre una idea, o en un lugar vacío para crear una idea suelta
        </div>
      )}
    </div>
  );
}
