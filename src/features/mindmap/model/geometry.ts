import { measureNode } from "./measure";
import { depthOf } from "./tree";
import type { Direction, LayoutMode, MindNodeModel } from "./types";

type Nodes = Record<string, MindNodeModel>;

export function centerOf(nodes: Nodes, id: string) {
  const n = nodes[id];
  const s = measureNode(n.text, depthOf(nodes, id));
  return { x: n.x + s.width / 2, y: n.y + s.height / 2, width: s.width, height: s.height };
}

/**
 * Hacia dónde "crece" un nodo: ahí va el botón de agregar hijo y el de plegar.
 * Los hermanos se agregan sobre el eje perpendicular.
 */
export function outwardOf(nodes: Nodes, rootId: string, id: string, mode: LayoutMode): Direction {
  if (mode === "tree") return "bottom";
  if (id === rootId) return "right";
  if (mode === "map") return nodes[id].side;
  const c = centerOf(nodes, id);
  const r = centerOf(nodes, rootId);
  const dx = c.x - r.x;
  const dy = c.y - r.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}

export function siblingAxis(outward: Direction): { before: Direction; after: Direction } {
  return outward === "left" || outward === "right"
    ? { before: "top", after: "bottom" }
    : { before: "left", after: "right" };
}

export function boundsOf(nodes: Nodes, ids: string[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const id of ids) {
    const c = centerOf(nodes, id);
    minX = Math.min(minX, c.x - c.width / 2);
    minY = Math.min(minY, c.y - c.height / 2);
    maxX = Math.max(maxX, c.x + c.width / 2);
    maxY = Math.max(maxY, c.y + c.height / 2);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
