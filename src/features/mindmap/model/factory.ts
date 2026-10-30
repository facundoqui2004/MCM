import { nanoid } from "nanoid";
import { computeLayout, applyPositions } from "./layout";
import type { MindMapDoc, MindNodeModel } from "./types";

export const newId = () => nanoid(10);

export function createNode(partial: Partial<MindNodeModel> & Pick<MindNodeModel, "parentId">): MindNodeModel {
  return {
    id: newId(),
    text: "Nueva idea",
    children: [],
    side: "right",
    color: 0,
    collapsed: false,
    x: 0,
    y: 0,
    ...partial,
  };
}

export function createDefaultDoc(title = "Idea central"): MindMapDoc {
  const root = createNode({ parentId: null, text: title });
  return { schemaVersion: 1, rootId: root.id, layoutMode: "map", autoLayout: true, nodes: { [root.id]: root } };
}

/** Mapa de ejemplo para el primer arranque: muestra ramas, colores y plegado. */
export function createSampleDoc(): MindMapDoc {
  const doc = createDefaultDoc("Lanzar Mindmap Studio");
  const nodes = doc.nodes;
  const add = (parentId: string, text: string, extra: Partial<MindNodeModel> = {}) => {
    const parent = nodes[parentId];
    const n = createNode({ parentId, text, side: parent.side, color: parent.color, ...extra });
    nodes[n.id] = n;
    nodes[parentId] = { ...parent, children: [...parent.children, n.id] };
    return n.id;
  };
  const r = doc.rootId;
  const prod = add(r, "Producto", { side: "right", color: 0 });
  add(prod, "Lienzo infinito");
  add(prod, "Atajos de teclado");
  add(prod, "Exportar a JSON");
  const tech = add(r, "Stack", { side: "right", color: 3 });
  add(tech, "Next.js App Router");
  add(tech, "React Flow v12");
  add(tech, "Drizzle + SQLite");
  const users = add(r, "Usuarios", { side: "left", color: 1 });
  add(users, "Estudiantes");
  add(users, "Equipos de producto");
  const risks = add(r, "Riesgos", { side: "left", color: 2 });
  add(risks, "Mapas de miles de nodos");
  add(risks, "Edición concurrente");
  return { ...doc, nodes: applyPositions(nodes, computeLayout(nodes, r, "map")) };
}
