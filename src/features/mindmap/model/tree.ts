import type { MindNodeModel } from "./types";

type Nodes = Record<string, MindNodeModel>;

export function depthOf(nodes: Nodes, id: string): number {
  let d = 0;
  let cur = nodes[id];
  while (cur?.parentId) {
    d++;
    cur = nodes[cur.parentId];
  }
  return d;
}

/** Todos los descendientes (incluidos los ocultos por plegado), sin el nodo. */
export function descendantsOf(nodes: Nodes, id: string): string[] {
  const out: string[] = [];
  const stack = [...(nodes[id]?.children ?? [])];
  while (stack.length) {
    const cur = stack.pop()!;
    out.push(cur);
    stack.push(...(nodes[cur]?.children ?? []));
  }
  return out;
}

/** Recorrido DFS en orden visual que no entra en subárboles plegados. */
export function visibleIds(nodes: Nodes, rootId: string): string[] {
  const out: string[] = [];
  const walk = (id: string) => {
    const n = nodes[id];
    if (!n) return;
    out.push(id);
    if (!n.collapsed) n.children.forEach(walk);
  };
  walk(rootId);
  return out;
}

export function visibleChildren(nodes: Nodes, id: string): string[] {
  const n = nodes[id];
  return n && !n.collapsed ? n.children : [];
}

export function leafCount(nodes: Nodes, id: string): number {
  const kids = visibleChildren(nodes, id);
  if (!kids.length) return 1;
  return kids.reduce((acc, k) => acc + leafCount(nodes, k), 0);
}

/**
 * Rama como lista Markdown con sangría (incluye lo plegado). Sirve para pegar
 * un pedazo del mapa en apuntes de Obsidian, Word o donde sea.
 */
export function toOutline(nodes: Nodes, id: string): string {
  const lines: string[] = [];
  const walk = (nid: string, depth: number) => {
    const n = nodes[nid];
    if (!n) return;
    const text = n.text.replace(/\n+/g, " ");
    lines.push(`${"  ".repeat(depth)}- ${text}`);
    n.children.forEach((c) => walk(c, depth + 1));
  };
  walk(id, 0);
  return lines.join("\n");
}
