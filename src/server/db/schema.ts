import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { MindMapDoc } from "@/features/mindmap/model/types";

/**
 * Un mapa = una fila. El árbol completo vive en `data` como JSON validado.
 *
 * ¿Por qué documento y no una tabla `nodes`? Un mapa mental se lee y se guarda
 * siempre entero, tiene cientos (no millones) de nodos y su estructura cambia
 * en cada tecla. Como documento: 1 lectura, 1 escritura atómica, y el control
 * de concurrencia es una sola columna `version`. Si en el futuro hace falta
 * colaboración en tiempo real, el paso natural es CRDT (Yjs) sobre este mismo
 * documento, no normalizar.
 */
export const mindMaps = sqliteTable("mind_maps", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  data: text("data", { mode: "json" }).$type<MindMapDoc>().notNull(),
  nodeCount: integer("node_count").notNull().default(1),
  version: integer("version").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type MindMapRow = typeof mindMaps.$inferSelect;
