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
  x: z.number().finite(),
  y: z.number().finite(),
});

export const mindMapDocSchema = z
  .object({
    schemaVersion: z.literal(1),
    rootId: z.string(),
    layoutMode: z.enum(["map", "tree", "radial"]),
    autoLayout: z.boolean(),
    nodes: z.record(z.string(), mindNodeSchema),
  })
  .superRefine((doc, ctx) => {
    const ids = Object.keys(doc.nodes);
    if (ids.length > 5000) ctx.addIssue({ code: "custom", message: "El mapa supera los 5000 nodos" });
    const root = doc.nodes[doc.rootId];
    if (!root || root.parentId !== null)
      ctx.addIssue({ code: "custom", message: "rootId no apunta a un nodo raíz" });
    for (const n of Object.values(doc.nodes)) {
      if (n.parentId !== null && !doc.nodes[n.parentId]?.children.includes(n.id))
        ctx.addIssue({ code: "custom", message: `El nodo ${n.id} no figura entre los hijos de su padre` });
      for (const c of n.children)
        if (doc.nodes[c]?.parentId !== n.id)
          ctx.addIssue({ code: "custom", message: `Hijo inconsistente ${c} en ${n.id}` });
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
