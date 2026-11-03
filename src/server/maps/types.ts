import type { MindMapDoc, MindMapRecord, MindMapSummary } from "@/features/mindmap/model/types";

export type SaveResult =
  | { ok: true; version: number; updatedAt: string }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "conflict"; current: MindMapRecord };

/** Dónde viven los mapas: la base de datos del sitio o el Google Drive del usuario */
export interface MapsRepository {
  storage: "local" | "drive";
  listMaps(): Promise<MindMapSummary[]>;
  getMap(id: string): Promise<MindMapRecord | null>;
  createMap(input: { title?: string; doc?: MindMapDoc }): Promise<MindMapRecord>;
  saveMap(id: string, input: { title: string; doc: MindMapDoc; version: number }): Promise<SaveResult>;
  deleteMap(id: string): Promise<boolean>;
}
