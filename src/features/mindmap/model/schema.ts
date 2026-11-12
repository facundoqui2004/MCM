import { z } from "zod";
import type { MindMapDoc } from "./types";

/**
 * Esquema compartido cliente/servidor. La API nunca guarda un documento que no
 * pase esta validación, y el import de JSON usa exactamente el mismo esquema.
 */
export const mindNodeSchema = z.object({
  id: z.string().min(1).max(64),
  parentId: z.string().nullable(),
  text: z.string().max(2000),
  children: z.array(z.string()),
  side: z.enum(["left", "right"]),
  color: z.number().int().min(0).max(64),
  collapsed: z.boolean(),
  note: z.string().max(20000).optional(),
  image: z
    .object({
      src: z
        .string()
        .max(900_000)
        .refine((s) => /^data:image\/(webp|jpeg|png);base64,/.test(s), "La imagen tiene que ser webp, jpeg o png"),
      w: z.number().int().min(1).max(4096),
      h: z.number().int().min(1).max(4096),
      dw: z.number().finite().min(24).max(2000).optional(),
    })
    .optional(),
  floating: z.boolean().optional(),
  fill: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  locked: z.boolean().optional(),
  bold: z.boolean().optional(),
  underline: z.boolean().optional(),
  x: z.number().finite(),
  y: z.number().finite(),
});

export const relationSchema = z.object({
  id: z.string().min(1).max(64),
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().max(200),
});

export const strokeSchema = z.object({
  id: z.string().min(1).max(64),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  width: z.number().positive().max(80),
  points: z.array(z.number().finite()).min(2).max(6000),
});

export const mindMapDocSchema = z
  .object({
    schemaVersion: z.literal(1),
    rootId: z.string(),
    layoutMode: z.enum(["map", "tree", "radial"]),
    autoLayout: z.boolean(),
    nodes: z.record(z.string(), mindNodeSchema),
    relations: z.array(relationSchema).max(1000).optional(),
    drawings: z.array(strokeSchema).max(3000).optional(),
  })
  .superRefine((doc, ctx) => {
    const ids = Object.keys(doc.nodes);
    if (ids.length > 5000) ctx.addIssue({ code: "custom", message: "El mapa supera los 5000 nodos" });
    const root = doc.nodes[doc.rootId];
    if (!root || root.parentId !== null)
      ctx.addIssue({ code: "custom", message: "rootId no apunta a un nodo raíz" });
    for (const n of Object.values(doc.nodes)) {
      if (n.parentId === null && n.id !== doc.rootId && !n.floating)
        ctx.addIssue({ code: "custom", message: `El nodo ${n.id} no tiene padre y no es una idea flotante` });
      if (n.parentId !== null && !doc.nodes[n.parentId]?.children.includes(n.id))
        ctx.addIssue({ code: "custom", message: `El nodo ${n.id} no figura entre los hijos de su padre` });
      for (const c of n.children)
        if (doc.nodes[c]?.parentId !== n.id)
          ctx.addIssue({ code: "custom", message: `Hijo inconsistente ${c} en ${n.id}` });
    }
    for (const r of doc.relations ?? []) {
      if (!doc.nodes[r.from] || !doc.nodes[r.to] || r.from === r.to)
        ctx.addIssue({ code: "custom", message: `La relación ${r.id} apunta a ideas que no existen` });
    }
  }) satisfies z.ZodType<MindMapDoc>;

export const createMapInput = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  doc: mindMapDocSchema.optional(),
});

export const saveMapInput = z.object({
  title: z.string().trim().min(1).max(120),
  doc: mindMapDocSchema,
  /** Control de concurrencia optimista: la versión que el cliente tenía al editar */
  version: z.number().int().positive(),
});

/** Formato del archivo exportado (incluye título para que el import lo recupere) */
export const exportFileSchema = z.object({
  format: z.literal("mindmap-studio"),
  title: z.string(),
  exportedAt: z.string(),
  doc: mindMapDocSchema,
});
export type ExportFile = z.infer<typeof exportFileSchema>;
