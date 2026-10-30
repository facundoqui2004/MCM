"use client";

import {
  Background,
  BackgroundVariant,
  ReactFlow,
  useReactFlow,
  useViewport,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { centerOf } from "../model/geometry";
import { measureNode } from "../model/measure";
import type { XY } from "../model/types";
import { useAnimatedPositions } from "../hooks/use-animated-positions";
import { useMindMap } from "../store/mindmap-store";
import { useTheme } from "@/features/theme/theme-store";
import { THEMES } from "@/features/theme/themes";
import { BranchEdge } from "./branch-edge";
import { MindNode } from "./mind-node";

const nodeTypes = { mind: MindNode };
const edgeTypes = { branch: BranchEdge };

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
    measured: measured.current.get(id) ?? measureNode(nodes[id].text, depths[id]),
  }));

  const rfEdges: Edge[] = useMemo(
    () =>
      ids
        .filter((id) => id !== rootId)
        .map((id) => ({ id: `e-${id}`, source: nodes[id].parentId!, target: id, type: "branch", zIndex: 0 })),
    [ids, nodes, rootId],
  );

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
      className={`mm-canvas ${spaceHeld ? "is-panning" : ""}`}
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
        nodesConnectable={false}
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
      </ReactFlow>
    </div>
  );
}
