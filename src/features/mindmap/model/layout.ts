import dagre from "@dagrejs/dagre";
import { measureNode } from "./measure";
import { depthOf, visibleChildren, visibleIds } from "./tree";
import type { LayoutMode, MindNodeModel, XY } from "./types";

type Nodes = Record<string, MindNodeModel>;
export type Positions = Record<string, XY>;

const sizeOf = (nodes: Nodes, id: string, depth: number) => measureNode(nodes[id].text, depth);

/* ------------------------------------------------------------------------ */
/* Layout bilateral (estilo XMind): "tidy tree" propio, determinista y que   */
/* respeta el orden de hermanos. Ramas izquierdas y derechas se apilan por   */
/* separado y quedan centradas verticalmente respecto de su padre.           */
/* ------------------------------------------------------------------------ */

const H_GAP_ROOT = 84;
const H_GAP = 52;
const V_GAP = 14;

function layoutBilateral(nodes: Nodes, rootId: string): Positions {
  const pos: Positions = {};
  const heightCache = new Map<string, number>();

  const subtreeHeight = (id: string, depth: number): number => {
    const cached = heightCache.get(id);
    if (cached !== undefined) return cached;
    const own = sizeOf(nodes, id, depth).height;
    const kids = visibleChildren(nodes, id);
    const stack =
      kids.reduce((acc, k) => acc + subtreeHeight(k, depth + 1), 0) + Math.max(0, kids.length - 1) * V_GAP;
    const h = Math.max(own, stack);
    heightCache.set(id, h);
    return h;
  };

  const placeChildren = (parentId: string, kids: string[], depth: number, dir: 1 | -1) => {
    if (!kids.length) return;
    const p = pos[parentId];
    const ps = sizeOf(nodes, parentId, depth);
    const centerY = p.y + ps.height / 2;
    const total =
      kids.reduce((acc, k) => acc + subtreeHeight(k, depth + 1), 0) + (kids.length - 1) * V_GAP;
    let cursor = centerY - total / 2;
    const gap = depth === 0 ? H_GAP_ROOT : H_GAP;
    for (const k of kids) {
      const ks = sizeOf(nodes, k, depth + 1);
      const sh = subtreeHeight(k, depth + 1);
      const x = dir === 1 ? p.x + ps.width + gap : p.x - gap - ks.width;
      pos[k] = { x, y: cursor + sh / 2 - ks.height / 2 };
      placeChildren(k, visibleChildren(nodes, k), depth + 1, dir);
      cursor += sh + V_GAP;
    }
  };

  const rs = sizeOf(nodes, rootId, 0);
  pos[rootId] = { x: -rs.width / 2, y: -rs.height / 2 };
  const kids = visibleChildren(nodes, rootId);
  placeChildren(rootId, kids.filter((k) => nodes[k].side === "right"), 0, 1);
  placeChildren(rootId, kids.filter((k) => nodes[k].side === "left"), 0, -1);
  return pos;
}

/* ------------------------------------------------------------------------ */
/* Árbol jerárquico vertical (organigrama).                                  */
/*                                                                           */
/* Primero se probó Dagre (rankdir TB), pero su minimización de cruces       */
/* reordena hermanos libremente: el orden que eligió el usuario no se        */
/* respeta. Para un árbol puro no hace falta un layout de grafos general,    */
/* así que usamos el mismo tidy tree que el bilateral, rotado 90°.           */
/* Dagre queda disponible (layoutDagreGraph) para cuando haya conexiones     */
/* cruzadas entre ramas (relaciones), que convierten el árbol en un DAG.     */
/* ------------------------------------------------------------------------ */

const TREE_H_GAP = 20;
const TREE_V_GAP = 60;

function layoutVerticalTree(nodes: Nodes, rootId: string): Positions {
  const pos: Positions = {};
  const widthCache = new Map<string, number>();

  const subtreeWidth = (id: string, depth: number): number => {
    const cached = widthCache.get(id);
    if (cached !== undefined) return cached;
    const own = sizeOf(nodes, id, depth).width;
    const kids = visibleChildren(nodes, id);
    const row = kids.reduce((acc, k) => acc + subtreeWidth(k, depth + 1), 0) + Math.max(0, kids.length - 1) * TREE_H_GAP;
    const w = Math.max(own, row);
    widthCache.set(id, w);
    return w;
  };

  // y de cada nivel = suma de las alturas máximas de los niveles anteriores
  const levelHeight: number[] = [];
  for (const id of visibleIds(nodes, rootId)) {
    const d = depthOf(nodes, id);
    levelHeight[d] = Math.max(levelHeight[d] ?? 0, sizeOf(nodes, id, d).height);
  }
  const levelY: number[] = [0];
  for (let d = 1; d < levelHeight.length; d++) levelY[d] = levelY[d - 1] + levelHeight[d - 1] + TREE_V_GAP;

  const place = (id: string, depth: number, centerX: number) => {
    const s = sizeOf(nodes, id, depth);
    pos[id] = { x: centerX - s.width / 2, y: levelY[depth] + (levelHeight[depth] - s.height) / 2 };
    const kids = visibleChildren(nodes, id);
    const total = kids.reduce((acc, k) => acc + subtreeWidth(k, depth + 1), 0) + (kids.length - 1) * TREE_H_GAP;
    let cursor = centerX - total / 2;
    for (const k of kids) {
      const w = subtreeWidth(k, depth + 1);
      place(k, depth + 1, cursor + w / 2);
      cursor += w + TREE_H_GAP;
    }
  };
  place(rootId, 0, 0);
  const r = pos[rootId];
  const rs = sizeOf(nodes, rootId, 0);
  // centramos en la raíz para que cambiar de layout no "salte" el lienzo
  const oy = r.y + rs.height / 2;
  for (const id of Object.keys(pos)) pos[id] = { x: pos[id].x, y: pos[id].y - oy };
  return pos;
}

/** Layout de grafo general con Dagre: reservado para mapas con relaciones cruzadas. */
export function layoutDagreGraph(nodes: Nodes, rootId: string, extraEdges: [string, string][] = []): Positions {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 22, ranksep: 64 });
  g.setDefaultEdgeLabel(() => ({}));
  const ids = visibleIds(nodes, rootId);
  for (const id of ids) {
    const s = sizeOf(nodes, id, depthOf(nodes, id));
    g.setNode(id, { width: s.width, height: s.height });
  }
  for (const id of ids) for (const k of visibleChildren(nodes, id)) g.setEdge(id, k);
  for (const [a, b] of extraEdges) if (g.hasNode(a) && g.hasNode(b)) g.setEdge(a, b);
  dagre.layout(g);
  const pos: Positions = {};
  const r = g.node(rootId);
  for (const id of ids) {
    const n = g.node(id);
    pos[id] = { x: n.x - n.width / 2 - r.x, y: n.y - n.height / 2 - r.y };
  }
  return pos;
}

/* ------------------------------------------------------------------------ */
/* Radial: cada rama recibe una cuña angular proporcional a sus hojas.       */
/* ------------------------------------------------------------------------ */

function layoutRadial(nodes: Nodes, rootId: string): Positions {
  const GAP = 18;
  const RING_STEP = 230;
  const rs = sizeOf(nodes, rootId, 0);
  let r1 = Math.max(240, rs.width / 2 + 120);

  /**
   * Ángulo que necesita un subárbol: lo que ocupa el propio nodo proyectado
   * sobre la tangente del círculo (un nodo ancho arriba del círculo ocupa
   * mucho más arco que al costado) o la suma de lo que necesitan sus hijos.
   */
  const ring = (d: number) => r1 + (d - 1) * RING_STEP;
  const angularNeed = (id: string, depth: number, theta: number): number => {
    const s = sizeOf(nodes, id, depth);
    const along = Math.abs(Math.sin(theta)) * s.width + Math.abs(Math.cos(theta)) * s.height + GAP;
    const own = along / ring(depth);
    const kids = visibleChildren(nodes, id).reduce((acc, k) => acc + angularNeed(k, depth + 1, theta), 0);
    return Math.max(own, kids);
  };

  // Si las ramas no entran en la vuelta completa, agrandamos el primer anillo.
  const firstLevel = visibleChildren(nodes, rootId);
  for (let i = 0; i < 6; i++) {
    const total = firstLevel.reduce((acc, k) => acc + angularNeed(k, 1, Math.PI / 4), 0);
    if (total <= Math.PI * 2 * 0.92) break;
    r1 *= total / (Math.PI * 2 * 0.85);
  }

  const pos: Positions = {};
  pos[rootId] = { x: -rs.width / 2, y: -rs.height / 2 };

  const place = (id: string, depth: number, w0: number, w1: number) => {
    const kids = visibleChildren(nodes, id);
    if (!kids.length) return;
    const theta = (w0 + w1) / 2;
    const needs = kids.map((k) => angularNeed(k, depth + 1, depth === 0 ? Math.PI / 4 : theta));
    const total = needs.reduce((a, b) => a + b, 0);
    // Raíz: reparte la vuelta completa. Resto: si la cuña sobra, se angosta
    // alrededor de su centro y los hijos quedan agrupados frente al padre.
    const span0 = depth === 0 ? w1 - w0 : Math.min(w1 - w0, total);
    let a = theta - span0 / 2;
    kids.forEach((k, i) => {
      const span = (span0 * needs[i]) / total;
      const mid = a + span / 2;
      const r = ring(depth + 1);
      const s = sizeOf(nodes, k, depth + 1);
      pos[k] = { x: Math.cos(mid) * r - s.width / 2, y: Math.sin(mid) * r - s.height / 2 };
      place(k, depth + 1, a, a + span);
      a += span;
    });
  };
  place(rootId, 0, -Math.PI / 2, (3 * Math.PI) / 2);
  return pos;
}

export function computeLayout(nodes: Nodes, rootId: string, mode: LayoutMode): Positions {
  if (mode === "tree") return layoutVerticalTree(nodes, rootId);
  if (mode === "radial") return layoutRadial(nodes, rootId);
  return layoutBilateral(nodes, rootId);
}

/** Aplica posiciones devolviendo un nuevo diccionario (sólo copia lo que cambió). */
export function applyPositions(nodes: Nodes, pos: Positions): Nodes {
  const out: Nodes = { ...nodes };
  for (const [id, p] of Object.entries(pos)) {
    const n = out[id];
    if (n && (n.x !== p.x || n.y !== p.y)) out[id] = { ...n, x: p.x, y: p.y };
  }
  return out;
}
