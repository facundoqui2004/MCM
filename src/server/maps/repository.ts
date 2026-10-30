import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createDefaultDoc } from "@/features/mindmap/model/factory";
import type { MindMapDoc, MindMapRecord, MindMapSummary } from "@/features/mindmap/model/types";
import { db, ensureSchema } from "../db/client";
import { mindMaps, type MindMapRow } from "../db/schema";

const toRecord = (r: MindMapRow): MindMapRecord => ({
  id: r.id,
  title: r.title,
  version: r.version,
  doc: r.data,
  updatedAt: r.updatedAt.toISOString(),
});

export async function listMaps(): Promise<MindMapSummary[]> {
  await ensureSchema();
  const rows = await db
    .select({ id: mindMaps.id, title: mindMaps.title, nodeCount: mindMaps.nodeCount, updatedAt: mindMaps.updatedAt })
    .from(mindMaps)
    .orderBy(desc(mindMaps.updatedAt));
  return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }));
}

export async function getMap(id: string): Promise<MindMapRecord | null> {
  await ensureSchema();
  const [row] = await db.select().from(mindMaps).where(eq(mindMaps.id, id)).limit(1);
  return row ? toRecord(row) : null;
}

export async function createMap(input: { title?: string; doc?: MindMapDoc }): Promise<MindMapRecord> {
  await ensureSchema();
  const title = input.title ?? "Mapa sin título";
  const doc = input.doc ?? createDefaultDoc(title);
  const now = new Date();
  const [row] = await db
    .insert(mindMaps)
    .values({ id: nanoid(12), title, data: doc, nodeCount: Object.keys(doc.nodes).length, version: 1, createdAt: now, updatedAt: now })
    .returning();
  return toRecord(row);
}

export type SaveResult =
  | { ok: true; version: number; updatedAt: string }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "conflict"; current: MindMapRecord };

/**
 * Guardado con concurrencia optimista: el UPDATE sólo aplica si la versión en
 * la base es la que el cliente tenía. Si otra pestaña guardó antes → conflicto.
 */
export async function saveMap(id: string, input: { title: string; doc: MindMapDoc; version: number }): Promise<SaveResult> {
  await ensureSchema();
  const now = new Date();
  const updated = await db
    .update(mindMaps)
    .set({
      title: input.title,
      data: input.doc,
      nodeCount: Object.keys(input.doc.nodes).length,
      version: sql`${mindMaps.version} + 1`,
      updatedAt: now,
    })
    .where(and(eq(mindMaps.id, id), eq(mindMaps.version, input.version)))
    .returning({ version: mindMaps.version });

  if (updated.length) return { ok: true, version: updated[0].version, updatedAt: now.toISOString() };
  const current = await getMap(id);
  return current ? { ok: false, reason: "conflict", current } : { ok: false, reason: "not_found" };
}

export async function deleteMap(id: string): Promise<boolean> {
  await ensureSchema();
  const res = await db.delete(mindMaps).where(eq(mindMaps.id, id)).returning({ id: mindMaps.id });
  return res.length > 0;
}
