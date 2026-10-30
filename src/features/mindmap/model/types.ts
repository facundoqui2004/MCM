/**
 * Modelo de dominio del mapa mental.
 *
 * El mapa se guarda como un árbol normalizado: un diccionario de nodos indexado
 * por id, donde cada nodo conoce a su padre y el orden de sus hijos. Esto hace
 * que las operaciones frecuentes (agregar, borrar, mover, plegar) sean O(1) o
 * O(subárbol), y que serializar a JSON sea trivial.
 */

export type Side = "left" | "right";

/** map = bilateral tipo XMind · tree = organigrama (Dagre) · radial = anillos */
export type LayoutMode = "map" | "tree" | "radial";

export type Direction = "left" | "right" | "top" | "bottom";

export interface XY {
  x: number;
  y: number;
}

export interface MindNodeModel {
  id: string;
  parentId: string | null;
  text: string;
  /** Orden de los hijos: define el orden visual en todos los layouts */
  children: string[];
  /** Lado de la rama en el layout bilateral (lo heredan los descendientes) */
  side: Side;
  /** Índice en la paleta de acentos; lo heredan los descendientes */
  color: number;
  collapsed: boolean;
  /**
   * Nota asociada en Markdown (opcional). Se ve al pasar el cursor por la idea
   * y se edita en una ventana fijada. Los mapas viejos no la tienen.
   */
  note?: string;
  /** Esquina superior izquierda en coordenadas del lienzo */
  x: number;
  y: number;
}

export interface MindMapDoc {
  schemaVersion: 1;
  rootId: string;
  layoutMode: LayoutMode;
  /** true: cada cambio estructural reordena todo. false: modo libre (hubo drag manual) */
  autoLayout: boolean;
  nodes: Record<string, MindNodeModel>;
}

export interface MindMapSummary {
  id: string;
  title: string;
  nodeCount: number;
  updatedAt: string;
}

export interface MindMapRecord {
  id: string;
  title: string;
  version: number;
  doc: MindMapDoc;
  updatedAt: string;
}
