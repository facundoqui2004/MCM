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

/** Imagen de una idea: ya comprimida en el navegador y guardada dentro del mapa */
export interface NodeImage {
  /** data URL (webp o jpeg) */
  src: string;
  /** tamaño en píxeles de la imagen guardada */
  w: number;
  h: number;
  /** ancho con el que se muestra en el lienzo, si el usuario lo ajustó a mano */
  dw?: number;
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
  /** Imagen que se muestra arriba del texto (opcional) */
  image?: NodeImage;
  /**
   * Idea flotante: suelta en el lienzo, sin padre (parentId null) pero no es la
   * idea central. Puede tener sus propias hijas; su posición la elige el usuario.
   */
  floating?: boolean;
  /** Color de relleno elegido por el usuario (#rrggbb). Sin él, el color sale del tema y la rama */
  fill?: string;
  /**
   * Idea bloqueada (candado): ella y toda su rama quedan fijas donde están.
   * No se pueden arrastrar y el orden automático no las mueve.
   */
  locked?: boolean;
  /** Texto en negrita */
  bold?: boolean;
  /** Texto subrayado */
  underline?: boolean;
  /** Esquina superior izquierda en coordenadas del lienzo */
  x: number;
  y: number;
}

/**
 * Flecha de relación libre entre dos ideas cualesquiera (además del árbol).
 * Va de `from` a `to` y puede tener un nombre que se muestra sobre la flecha.
 */
export interface Relation {
  id: string;
  from: string;
  to: string;
  label: string;
}

/**
 * Trazo dibujado a mano alzada sobre el mapa (lápiz). Los puntos están en
 * coordenadas del lienzo, así que el dibujo acompaña el zoom y el paneo.
 */
export interface Stroke {
  id: string;
  /** #rrggbb */
  color: string;
  /** grosor en unidades del lienzo */
  width: number;
  /** x0, y0, x1, y1, … */
  points: number[];
}

export interface MindMapDoc {
  schemaVersion: 1;
  rootId: string;
  layoutMode: LayoutMode;
  /** true: cada cambio estructural reordena todo. false: modo libre (hubo drag manual) */
  autoLayout: boolean;
  nodes: Record<string, MindNodeModel>;
  /** Relaciones libres. Los mapas viejos no las tienen */
  relations?: Relation[];
  /** Dibujos a mano alzada. Los mapas viejos no los tienen */
  drawings?: Stroke[];
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
  /** "drive": en el Google Drive del usuario · "local": en la base de datos del sitio */
  storage?: "drive" | "local";
}
