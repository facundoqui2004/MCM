import type { MindMapDoc, MindMapRecord, MindMapSummary } from "../model/types";

export class ConflictError extends Error {
  constructor(public current: MindMapRecord) {
    super("El mapa cambió en otra pestaña o dispositivo");
  }
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const mapsApi = {
  list: () => fetch("/api/maps", { cache: "no-store" }).then((r) => json<MindMapSummary[]>(r)),

  get: (id: string) => fetch(`/api/maps/${id}`, { cache: "no-store" }).then((r) => json<MindMapRecord>(r)),

  create: (input: { title?: string; doc?: MindMapDoc } = {}) =>
    fetch("/api/maps", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => json<MindMapRecord>(r)),

  save: async (id: string, input: { title: string; doc: MindMapDoc; version: number }) => {
    const res = await fetch(`/api/maps/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      keepalive: true,
    });
    if (res.status === 409) throw new ConflictError((await res.json()).current);
    return json<{ version: number; updatedAt: string }>(res);
  },

  remove: (id: string) => fetch(`/api/maps/${id}`, { method: "DELETE" }).then((r) => json<{ ok: true }>(r)),
};
