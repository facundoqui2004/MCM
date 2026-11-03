import type { MindMapDoc, MindMapRecord, MindMapSummary } from "../model/types";

/** Límite de los navegadores para pedidos keepalive (64 KB), con margen */
const KEEPALIVE_MAX_BYTES = 60_000;

export class ConflictError extends Error {
  constructor(public current: MindMapRecord) {
    super("El mapa cambió en otra pestaña o dispositivo");
  }
}

/** La sesión de Google venció: hay que volver a iniciar sesión (lo que hay en pantalla no se pierde) */
export class AuthError extends Error {}

async function json<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    throw new AuthError(body.error ?? "Iniciá sesión de nuevo");
  }
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
    const body = JSON.stringify(input);
    const res = await fetch(`/api/maps/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body,
      // keepalive deja terminar el guardado aunque se cierre la pestaña, pero el navegador
      // rechaza esos pedidos si pesan más de 64 KB (un mapa con fotos): ahí va uno normal
      keepalive: new Blob([body]).size < KEEPALIVE_MAX_BYTES,
    });
    if (res.status === 409) throw new ConflictError((await res.json()).current);
    return json<{ version: number; updatedAt: string }>(res);
  },

  remove: (id: string) => fetch(`/api/maps/${id}`, { method: "DELETE" }).then((r) => json<{ ok: true }>(r)),
};
