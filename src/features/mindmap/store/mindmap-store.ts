"use client";

import { nanoid } from "nanoid";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { createNode } from "../model/factory";
import { applyPositions, computeLayout } from "../model/layout";
import { measureNode } from "../model/measure";
import { BRANCH_COUNT } from "../model/palette";
import { depthOf, descendantsOf, floatingRoots, visibleChildren } from "../model/tree";
import type { Direction, LayoutMode, MindMapDoc, MindNodeModel, NodeImage, Relation, Side, XY } from "../model/types";

type Nodes = Record<string, MindNodeModel>;

interface Snapshot {
  nodes: Nodes;
  rootId: string;
  layoutMode: LayoutMode;
  autoLayout: boolean;
  relations: Relation[];
}

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict" | "auth";

export interface MindMapState extends Snapshot {
  mapId: string | null;
  title: string;
  version: number;
  selectedId: string | null;
  editingId: string | null;
  /** Texto inicial al entrar a edición tecleando sobre un nodo seleccionado */
  editSeed: string | null;
  /** Texto en edición (no persistido): el nodo se autoajusta leyendo esto */
  editDraft: string | null;
  dragging: boolean;
  /** Flecha de relación seleccionada (excluye a selectedId: o una idea o una flecha) */
  selectedRelationId: string | null;
  /** Flecha cuyo nombre se está escribiendo */
  editingRelationId: string | null;
  /** Se incrementa en cada cambio persistible: el autosave escucha esto */
  revision: number;
  /** Se incrementa cuando cargan las webfonts y cambian las medidas */
  fontEpoch: number;
  saveStatus: SaveStatus;
  past: Snapshot[];
  future: Snapshot[];
  /** Último borrado, para el aviso con "Deshacer" (stamp cambia en cada borrado) */
  lastDeleted: { text: string; descendants: number; stamp: number } | null;
  /** Aviso breve (por ejemplo "Rama copiada") */
  notice: { text: string; stamp: number } | null;

  load: (input: { mapId: string; title: string; version: number; doc: MindMapDoc }) => void;
  toDoc: () => MindMapDoc;
  setTitle: (title: string) => void;
  setSaveStatus: (s: SaveStatus, version?: number) => void;

  select: (id: string | null) => void;
  startEdit: (id: string, seed?: string) => void;
  setDraft: (text: string) => void;
  commitEdit: (id: string, text: string) => void;
  cancelEdit: () => void;

  addChild: (parentId: string, side?: Side, edit?: boolean) => string;
  addSibling: (id: string, where?: "before" | "after", edit?: boolean) => string;
  deleteNode: (id: string) => void;
  toggleCollapse: (id: string, value?: boolean) => void;
  /** Pliega todas las ramas: queda la idea central con sus ramas principales */
  collapseAll: () => void;
  /** Despliega el nivel plegado menos profundo: repetirlo revela el mapa de a un nivel */
  expandLevel: () => void;
  dismissDeleted: () => void;
  /**
   * Guarda la nota de una idea. Con `history: false` el cambio se suma al
   * último paso del historial: así una sesión de escritura se deshace de una vez.
   */
  setNote: (id: string, note: string, opts?: { history?: boolean }) => void;
  /** Despliega los ancestros plegados de una idea y la selecciona (búsqueda) */
  reveal: (id: string) => void;
  notify: (text: string) => void;
  dismissNotice: () => void;

  /**
   * Crea una idea flotante (suelta, sin conectar al árbol) con su esquina en `pos`
   * (coordenadas del lienzo). Si trae imagen, nace sin texto.
   */
  addFloating: (pos: XY, opts?: { image?: NodeImage }) => string;
  /** Pone o quita (null) la imagen de una idea */
  setImage: (id: string, image: NodeImage | null) => boolean;

  /** Crea una flecha de relación (si ya existe entre esas dos ideas, la selecciona) */
  addRelation: (from: string, to: string) => string | null;
  selectRelation: (id: string | null) => void;
  startRelationEdit: (id: string) => void;
  /** Confirma el nombre de la flecha; null = cancelar */
  commitRelationLabel: (id: string, label: string | null) => void;
  reverseRelation: (id: string) => void;
  deleteRelation: (id: string) => void;

  beginDrag: () => void;
  dragTo: (id: string, position: XY) => void;
  endDrag: () => void;

  setLayoutMode: (mode: LayoutMode) => void;
  tidy: () => void;
  onFontsReady: () => void;
  navigate: (dir: Direction) => void;

  undo: () => void;
  redo: () => void;
}

const HISTORY_LIMIT = 120;
/** Tope de imágenes por mapa (en caracteres de data URL): el mapa se guarda entero en cada autoguardado */
const IMAGES_BUDGET = 3_600_000;

const snap = (s: Snapshot): Snapshot => ({
  nodes: s.nodes,
  rootId: s.rootId,
  layoutMode: s.layoutMode,
  autoLayout: s.autoLayout,
  relations: s.relations,
});

/** Saca las relaciones que quedaron apuntando a ideas borradas */
const liveRelations = (relations: Relation[], nodes: Nodes) =>
  relations.filter((r) => nodes[r.from] && nodes[r.to]);

const relaid = (s: Snapshot, nodes: Nodes = s.nodes): Nodes =>
  applyPositions(nodes, computeLayout(nodes, s.rootId, s.layoutMode));

/**
 * Deshacer/rehacer restauran la estructura de una foto del historial, pero el
 * plegado se queda como está ahora: plegar no es una edición (no entra al
 * historial), así que volver atrás no debería re-plegar ramas que ya abriste.
 */
function withCurrentFolds(target: Snapshot, current: Nodes): Snapshot {
  let changed = false;
  const nodes: Nodes = { ...target.nodes };
  for (const id of Object.keys(nodes)) {
    const now = current[id];
    if (now && now.collapsed !== nodes[id].collapsed) {
      nodes[id] = { ...nodes[id], collapsed: now.collapsed };
      changed = true;
    }
  }
  if (!changed) return target;
  return { ...target, nodes: target.autoLayout ? relaid(target, nodes) : nodes };
}

/**
 * Coloca un nodo nuevo en modo libre (sin auto-layout): al costado del padre,
 * debajo del último hermano visible.
 */
function freePlacement(nodes: Nodes, parentId: string, newId: string, rootId: string): XY {
  const parent = nodes[parentId];
  const child = nodes[newId];
  const pd = depthOf(nodes, parentId);
  const ps = measureNode(parent.text, pd, parent.image);
  const cs = measureNode(child.text, pd + 1, child.image);
  const siblings = parent.children.filter((c) => c !== newId && nodes[c].side === child.side);
  const gap = parentId === rootId ? 84 : 52;
  const x = child.side === "right" ? parent.x + ps.width + gap : parent.x - gap - cs.width;
  if (!siblings.length) return { x, y: parent.y + ps.height / 2 - cs.height / 2 };
  const last = nodes[siblings[siblings.length - 1]];
  const ls = measureNode(last.text, pd + 1, last.image);
  return { x, y: last.y + ls.height + 14 };
}

export const useMindMap = create<MindMapState>()(
  subscribeWithSelector((set, get) => {
    /** Toda mutación persistible pasa por acá: guarda historial y marca dirty. */
    const commit = (patch: Partial<MindMapState>, opts: { history?: boolean } = {}) => {
      const s = get();
      const history = opts.history ?? true;
      set({
        // cualquier cambio nuevo invalida el "Deshacer" del aviso de borrado
        lastDeleted: null,
        ...patch,
        ...(history ? { past: [...s.past, snap(s)].slice(-HISTORY_LIMIT), future: [] } : null),
        revision: s.revision + 1,
        saveStatus: "dirty",
      });
    };

    /** Si el auto-layout está activo, reordena todo; si no, devuelve los nodos tal cual. */
    const settle = (nodes: Nodes): Nodes => {
      const s = get();
      return s.autoLayout ? relaid(s, nodes) : nodes;
    };

    return {
      mapId: null,
      title: "",
      version: 1,
      nodes: {},
      rootId: "",
      layoutMode: "map",
      autoLayout: true,
      relations: [],
      selectedRelationId: null,
      editingRelationId: null,
      selectedId: null,
      editingId: null,
      editSeed: null,
      editDraft: null,
      dragging: false,
      revision: 0,
      fontEpoch: 0,
      saveStatus: "idle",
      past: [],
      future: [],
      lastDeleted: null,
      notice: null,

      load: ({ mapId, title, version, doc }) =>
        set({
          mapId,
          title,
          version,
          nodes: doc.nodes,
          rootId: doc.rootId,
          layoutMode: doc.layoutMode,
          autoLayout: doc.autoLayout,
          relations: liveRelations(doc.relations ?? [], doc.nodes),
          selectedRelationId: null,
          editingRelationId: null,
          selectedId: doc.rootId,
          // Un mapa que todavía es sólo la idea central abre listo para escribir el tema
          editingId: Object.keys(doc.nodes).length === 1 ? doc.rootId : null,
          editDraft: Object.keys(doc.nodes).length === 1 ? (doc.nodes[doc.rootId]?.text ?? "") : null,
          editSeed: null,
          lastDeleted: null,
          past: [],
          future: [],
          revision: 0,
          saveStatus: "saved",
        }),

      toDoc: () => {
        const s = get();
        return {
          schemaVersion: 1,
          rootId: s.rootId,
          layoutMode: s.layoutMode,
          autoLayout: s.autoLayout,
          nodes: s.nodes,
          ...(s.relations.length ? { relations: s.relations } : null),
        };
      },

      setTitle: (title) => commit({ title }, { history: false }),
      setSaveStatus: (saveStatus, version) => set(version ? { saveStatus, version } : { saveStatus }),

      select: (id) => set({ selectedId: id, selectedRelationId: null, editingRelationId: null }),

      startEdit: (id, seed) => {
        const n = get().nodes[id];
        set({ selectedId: id, selectedRelationId: null, editingRelationId: null, editingId: id, editSeed: seed ?? null, editDraft: seed ?? n?.text ?? "" });
      },
      setDraft: (editDraft) => set({ editDraft }),
      cancelEdit: () => set({ editingId: null, editSeed: null, editDraft: null }),
      commitEdit: (id, raw) => {
        const s = get();
        const n = s.nodes[id];
        set({ editingId: null, editSeed: null, editDraft: null });
        // una idea con imagen puede quedar sin texto (sólo la imagen)
        const text = raw.trim() || (n?.image ? "" : n?.text || "Nueva idea");
        if (!n || n.text === text) return;
        // El título del mapa sigue a la idea central mientras nadie lo haya editado a mano
        // (si todavía coincide con el texto anterior de la raíz, se considera "no tocado").
        const followsRoot = id === s.rootId && (s.title.trim() === "" || s.title === n.text);
        commit({
          nodes: settle({ ...s.nodes, [id]: { ...n, text } }),
          ...(followsRoot ? { title: text.split("\n")[0].slice(0, 120) } : null),
        });
      },

      addChild: (parentId, side, edit = true) => {
        const s = get();
        const parent = s.nodes[parentId];
        const isRoot = parentId === s.rootId;
        let childSide: Side = parent.side;
        let color = parent.color;
        if (isRoot) {
          const kids = parent.children.map((c) => s.nodes[c]);
          const right = kids.filter((k) => k.side === "right").length;
          childSide = side ?? (right <= kids.length - right ? "right" : "left");
          color = kids.length % BRANCH_COUNT;
        }
        const child = createNode({ parentId, side: childSide, color });
        // si el padre estaba plegado, lo desplegamos para que el nuevo hijo se vea
        let nodes: Nodes = {
          ...s.nodes,
          [parentId]: { ...parent, collapsed: false, children: [...parent.children, child.id] },
          [child.id]: child,
        };
        if (!s.autoLayout) {
          const p = freePlacement(nodes, parentId, child.id, s.rootId);
          nodes[child.id] = { ...child, ...p };
        } else {
          // posición inicial = la del padre, así el nodo "nace" desde él al animar
          nodes[child.id] = { ...child, x: parent.x, y: parent.y };
          nodes = relaid(s, nodes);
        }
        commit({ nodes, selectedId: child.id, selectedRelationId: null, editingRelationId: null, editingId: edit ? child.id : null, editSeed: null, editDraft: edit ? child.text : null });
        return child.id;
      },

      addSibling: (id, where = "after", edit = true) => {
        const s = get();
        const node = s.nodes[id];
        if (!node.parentId) return get().addChild(id, undefined, edit);
        const parent = s.nodes[node.parentId];
        // una rama principal nueva (hermana directa bajo la idea central) estrena color
        const color = parent.id === s.rootId ? parent.children.length % BRANCH_COUNT : node.color;
        const sib = createNode({ parentId: parent.id, side: node.side, color });
        const idx = parent.children.indexOf(id) + (where === "after" ? 1 : 0);
        const children = [...parent.children];
        children.splice(idx, 0, sib.id);
        let nodes: Nodes = { ...s.nodes, [parent.id]: { ...parent, children }, [sib.id]: sib };
        if (s.autoLayout) {
          nodes[sib.id] = { ...sib, x: node.x, y: node.y };
          nodes = relaid(s, nodes);
        } else {
          const ns = measureNode(node.text, depthOf(s.nodes, id), node.image);
          const dy = where === "after" ? ns.height + 14 : -(ns.height + 14);
          nodes[sib.id] = { ...sib, x: node.x, y: node.y + dy };
        }
        commit({ nodes, selectedId: sib.id, selectedRelationId: null, editingRelationId: null, editingId: edit ? sib.id : null, editSeed: null, editDraft: edit ? sib.text : null });
        return sib.id;
      },

      deleteNode: (id) => {
        const s = get();
        const node = s.nodes[id];
        if (!node || id === s.rootId) return; // la raíz no se borra
        if (!node.parentId) {
          // idea flotante: se va con toda su rama
          const nodes: Nodes = { ...s.nodes };
          const gone = descendantsOf(s.nodes, id);
          for (const d of [id, ...gone]) delete nodes[d];
          commit({
            nodes: settle(nodes),
            relations: liveRelations(s.relations, nodes),
            selectedId: s.rootId,
            editingId: null,
            editDraft: null,
            lastDeleted: { text: node.text || "Imagen", descendants: gone.length, stamp: Date.now() },
          });
          return;
        }
        const parent = s.nodes[node.parentId];
        const idx = parent.children.indexOf(id);
        const nextSel = parent.children[idx + 1] ?? parent.children[idx - 1] ?? parent.id;
        const nodes: Nodes = { ...s.nodes, [parent.id]: { ...parent, children: parent.children.filter((c) => c !== id) } };
        const gone = descendantsOf(s.nodes, id);
        for (const d of [id, ...gone]) delete nodes[d];
        commit({
          nodes: settle(nodes),
          relations: liveRelations(s.relations, nodes),
          selectedId: nextSel,
          editingId: null,
          editDraft: null,
          lastDeleted: { text: node.text || "Imagen", descendants: gone.length, stamp: Date.now() },
        });
      },
      dismissDeleted: () => set({ lastDeleted: null }),

      setNote: (id, note, opts = {}) => {
        const s = get();
        const n = s.nodes[id];
        if (!n || (n.note ?? "") === note) return;
        const next: MindNodeModel = { ...n };
        // "" borra la nota; espacios o saltos sueltos se conservan mientras se escribe.
        // Mismo tope que el esquema de la API: si no, el autoguardado fallaría siempre.
        if (note) next.note = note.slice(0, 20000);
        else delete next.note;
        // la nota no cambia el tamaño de la idea: no hace falta re-layout
        commit({ nodes: { ...s.nodes, [id]: next } }, { history: opts.history ?? true });
      },

      toggleCollapse: (id, value) => {
        const s = get();
        const n = s.nodes[id];
        if (!n || !n.children.length) return;
        const collapsed = value ?? !n.collapsed;
        if (collapsed === n.collapsed) return;
        // plegar es repasar, no editar: se guarda pero no entra en el historial de Ctrl Z
        commit({ nodes: settle({ ...s.nodes, [id]: { ...n, collapsed } }) }, { history: false });
      },

      collapseAll: () => {
        const s = get();
        const nodes: Nodes = { ...s.nodes };
        let changed = false;
        for (const n of Object.values(s.nodes)) {
          if (n.id !== s.rootId && n.children.length && !n.collapsed) {
            nodes[n.id] = { ...n, collapsed: true };
            changed = true;
          }
        }
        const root = nodes[s.rootId];
        if (root.collapsed) {
          nodes[s.rootId] = { ...root, collapsed: false };
          changed = true;
        }
        if (!changed) return;
        // si la selección quedó oculta, vuelve a la rama principal que la contiene
        let sel = s.selectedId;
        while (sel && depthOf(nodes, sel) > 1) sel = nodes[sel].parentId;
        commit({ nodes: settle(nodes), selectedId: sel }, { history: false });
      },

      expandLevel: () => {
        const s = get();
        // nodos plegados que hoy se ven, agrupados por profundidad
        const visibleCollapsed: { id: string; depth: number }[] = [];
        const walk = (id: string, d: number) => {
          const n = s.nodes[id];
          if (n.collapsed && n.children.length) visibleCollapsed.push({ id, depth: d });
          else n.children.forEach((c) => walk(c, d + 1));
        };
        walk(s.rootId, 0);
        for (const f of floatingRoots(s.nodes, s.rootId)) walk(f, 1);
        if (!visibleCollapsed.length) return;
        const shallowest = Math.min(...visibleCollapsed.map((v) => v.depth));
        const nodes: Nodes = { ...s.nodes };
        for (const v of visibleCollapsed)
          if (v.depth === shallowest) nodes[v.id] = { ...nodes[v.id], collapsed: false };
        commit({ nodes: settle(nodes) }, { history: false });
      },

      reveal: (id) => {
        const s = get();
        if (!s.nodes[id]) return;
        const nodes: Nodes = { ...s.nodes };
        let changed = false;
        for (let p = s.nodes[id].parentId; p; p = s.nodes[p].parentId) {
          if (nodes[p].collapsed) {
            nodes[p] = { ...nodes[p], collapsed: false };
            changed = true;
          }
        }
        if (changed) commit({ nodes: settle(nodes), selectedId: id }, { history: false });
        else set({ selectedId: id });
      },

      notify: (text) => set({ notice: { text, stamp: Date.now() } }),
      dismissNotice: () => set({ notice: null }),

      addFloating: (pos, opts = {}) => {
        const s = get();
        const count = floatingRoots(s.nodes, s.rootId).length;
        const root = s.nodes[s.rootId];
        const node = createNode({
          parentId: null,
          floating: true,
          side: "right",
          // color propio, siguiendo la paleta de las ramas
          color: (root.children.length + count) % BRANCH_COUNT,
          text: opts.image ? "" : "Idea suelta",
          ...(opts.image ? { image: opts.image } : null),
          x: Math.round(pos.x),
          y: Math.round(pos.y),
        });
        const edit = !opts.image;
        commit({
          nodes: { ...s.nodes, [node.id]: node },
          selectedId: node.id,
          selectedRelationId: null,
          editingRelationId: null,
          editingId: edit ? node.id : null,
          editSeed: null,
          editDraft: edit ? node.text : null,
        });
        return node.id;
      },

      setImage: (id, image) => {
        const s = get();
        const n = s.nodes[id];
        if (!n) return false;
        if (image) {
          const used = Object.values(s.nodes).reduce((acc, m) => acc + (m.id === id ? 0 : (m.image?.src.length ?? 0)), 0);
          if (used + image.src.length > IMAGES_BUDGET) {
            s.notify("El mapa ya tiene demasiadas imágenes. Quitá alguna para agregar otra");
            return false;
          }
        }
        const next: MindNodeModel = { ...n };
        if (image) next.image = image;
        else {
          delete next.image;
          if (!next.text.trim()) next.text = "Nueva idea";
        }
        commit({ nodes: settle({ ...s.nodes, [id]: next }) });
        return true;
      },

      addRelation: (from, to) => {
        const s = get();
        if (from === to || !s.nodes[from] || !s.nodes[to]) return null;
        const existing = s.relations.find((r) => (r.from === from && r.to === to) || (r.from === to && r.to === from));
        if (existing) {
          set({ selectedRelationId: existing.id, selectedId: null, editingRelationId: null });
          s.notify("Esas dos ideas ya están relacionadas");
          return existing.id;
        }
        const rel: Relation = { id: nanoid(10), from, to, label: "" };
        // recién creada, queda lista para escribirle el nombre (Enter vacío = sin nombre)
        commit({ relations: [...s.relations, rel], selectedRelationId: rel.id, editingRelationId: rel.id, selectedId: null });
        return rel.id;
      },
      selectRelation: (id) => set({ selectedRelationId: id, editingRelationId: null, ...(id ? { selectedId: null } : null) }),
      startRelationEdit: (id) => set({ selectedRelationId: id, editingRelationId: id, selectedId: null }),
      commitRelationLabel: (id, raw) => {
        const s = get();
        set({ editingRelationId: null });
        const r = s.relations.find((x) => x.id === id);
        if (!r || raw === null) return;
        const label = raw.trim().slice(0, 200);
        if (label === r.label) return;
        commit({ relations: s.relations.map((x) => (x.id === id ? { ...x, label } : x)) });
      },
      reverseRelation: (id) => {
        const s = get();
        commit({ relations: s.relations.map((x) => (x.id === id ? { ...x, from: x.to, to: x.from } : x)) });
      },
      deleteRelation: (id) => {
        const s = get();
        if (!s.relations.some((r) => r.id === id)) return;
        commit({ relations: s.relations.filter((r) => r.id !== id), selectedRelationId: null, editingRelationId: null });
        get().notify("Relación borrada · Ctrl Z para recuperarla");
      },

      beginDrag: () => {
        const s = get();
        set({ dragging: true, past: [...s.past, snap(s)].slice(-HISTORY_LIMIT), future: [] });
      },
      /** Arrastrar un nodo mueve su subárbol completo y pasa el mapa a modo libre. */
      dragTo: (id, position) => {
        const s = get();
        const n = s.nodes[id];
        if (!n) return;
        const dx = position.x - n.x;
        const dy = position.y - n.y;
        if (!dx && !dy) return;
        const nodes: Nodes = { ...s.nodes };
        for (const d of [id, ...descendantsOf(s.nodes, id)]) {
          const dn = nodes[d];
          nodes[d] = { ...dn, x: dn.x + dx, y: dn.y + dy };
        }
        // Mover una idea flotante es elegir su lugar: el resto del mapa sigue ordenándose solo.
        // Mover cualquier otra idea pasa el mapa a modo libre.
        set(n.floating && !n.parentId ? { nodes } : { nodes, autoLayout: false });
      },
      endDrag: () => commit({ dragging: false }, { history: false }),

      setLayoutMode: (layoutMode) => {
        const s = get();
        const next = { ...snap(s), layoutMode, autoLayout: true };
        commit({ layoutMode, autoLayout: true, nodes: relaid(next) });
      },
      tidy: () => {
        const s = get();
        commit({ autoLayout: true, nodes: relaid({ ...snap(s), autoLayout: true }) });
      },
      onFontsReady: () => {
        const s = get();
        // re-layout sin historial ni dirty: es un ajuste de medición, no una edición
        set({ fontEpoch: s.fontEpoch + 1, nodes: s.autoLayout && s.rootId ? relaid(s) : s.nodes });
      },

      /** Flechas: moverse por el árbol según la geometría visible. */
      navigate: (dir) => {
        const s = get();
        const id = s.selectedId ?? s.rootId;
        const n = s.nodes[id];
        if (!n) return;
        const center = (m: MindNodeModel) => {
          const sz = measureNode(m.text, depthOf(s.nodes, m.id), m.image);
          return { x: m.x + sz.width / 2, y: m.y + sz.height / 2 };
        };
        const c = center(n);
        const candidates = [
          ...(n.parentId ? [n.parentId] : []),
          ...visibleChildren(s.nodes, id),
          ...(n.parentId ? s.nodes[n.parentId].children.filter((x) => x !== id) : []),
        ];
        let best: string | null = null;
        let bestScore = Infinity;
        for (const cid of candidates) {
          const cc = center(s.nodes[cid]);
          const dx = cc.x - c.x;
          const dy = cc.y - c.y;
          const along = dir === "right" ? dx : dir === "left" ? -dx : dir === "bottom" ? dy : -dy;
          const across = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
          if (along <= 4) continue;
          const score = along + across * 2;
          if (score < bestScore) {
            bestScore = score;
            best = cid;
          }
        }
        if (best) set({ selectedId: best });
      },

      undo: () => {
        const s = get();
        const prev = s.past[s.past.length - 1];
        if (!prev) return;
        set({
          ...withCurrentFolds(prev, s.nodes),
          past: s.past.slice(0, -1),
          future: [snap(s), ...s.future],
          editingId: null,
          editDraft: null,
          editingRelationId: null,
          selectedRelationId: prev.relations.some((r) => r.id === s.selectedRelationId) ? s.selectedRelationId : null,
          lastDeleted: null,
          selectedId: prev.nodes[s.selectedId ?? ""] ? s.selectedId : prev.rootId,
          revision: s.revision + 1,
          saveStatus: "dirty",
        });
      },
      redo: () => {
        const s = get();
        const next = s.future[0];
        if (!next) return;
        set({
          ...withCurrentFolds(next, s.nodes),
          past: [...s.past, snap(s)],
          future: s.future.slice(1),
          editingId: null,
          editDraft: null,
          editingRelationId: null,
          selectedRelationId: next.relations.some((r) => r.id === s.selectedRelationId) ? s.selectedRelationId : null,
          lastDeleted: null,
          selectedId: next.nodes[s.selectedId ?? ""] ? s.selectedId : next.rootId,
          revision: s.revision + 1,
          saveStatus: "dirty",
        });
      },
    };
  }),
);
