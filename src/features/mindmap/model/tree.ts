import type { MindNodeModel } from "./types";

type Nodes = Record<string, MindNodeModel>;

/**
 * Profundidad de una idea. Una idea flotante cuenta como profundidad 1 (se ve
 * como una rama principal) y sus hijas siguen desde ahí.
 */
export function depthOf(nodes: Nodes, id: string): number {
  let d = 0;
  let cur = nodes[id];
  while (cur?.parentId) {
    d++;
    cur = nodes[cur.parentId];
  }
  return cur?.floating ? d + 1 : d;
}

/** La idea más alta de la que cuelga (la central o una flotante) */
export function topOf(nodes: Nodes, id: string): string {
  let cur = nodes[id];
  while (cur?.parentId && nodes[cur.parentId]) cur = nodes[cur.parentId];
  return cur?.id ?? id;
}

/** Ideas flotantes (sueltas en el lienzo), en orden estable */
export function floatingRoots(nodes: Nodes, rootId: string): string[] {
  return Object.values(nodes)
    .filter((n) => n.parentId === null && n.id !== rootId && n.floating)
    .map((n) => n.id)
    .sort();
}

/** Visibles del mapa completo: la idea central con su árbol y cada flotante con el suyo */
export function allVisibleIds(nodes: Nodes, rootId: string): string[] {
  return [rootId, ...floatingRoots(nodes, rootId)].flatMap((r) => visibleIds(nodes, r));
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

/** La idea bloqueada (candado) que fija a `id`: ella misma o un ancestro. null = está libre */
export function lockOwner(nodes: Nodes, id: string): string | null {
  let cur: MindNodeModel | undefined = nodes[id];
  while (cur) {
    if (cur.locked) return cur.id;
    cur = cur.parentId ? nodes[cur.parentId] : undefined;
  }
  return null;
}

/** Todas las ideas fijas: las bloqueadas y sus ramas completas */
export function lockedIds(nodes: Nodes): Set<string> {
  const out = new Set<string>();
  for (const n of Object.values(nodes)) {
    if (!n.locked || out.has(n.id)) continue;
    out.add(n.id);
    for (const d of descendantsOf(nodes, n.id)) out.add(d);
  }
  return out;
}
