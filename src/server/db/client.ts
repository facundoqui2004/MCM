import "server-only";
import { mkdirSync } from "node:fs";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * SQLite local vía libSQL. Para producción alcanza con cambiar DATABASE_URL a
 * Turso (libsql://…) o pasar a PostgreSQL con `drizzle-orm/node-postgres`
 * y `pgTable` (el repositorio no cambia).
 */
const url = process.env.DATABASE_URL ?? "file:./data/mindmaps.db";

/**
 * En Vercel el sistema de archivos es de sólo lectura y efímero: un SQLite en
 * archivo perdería los mapas en cada despliegue. Ahí exigimos una base remota
 * (Turso: DATABASE_URL=libsql://… + DATABASE_AUTH_TOKEN) y avisamos con un
 * error que dice exactamente qué falta, en vez de un EROFS críptico.
 */
const missingRemoteDb = Boolean(process.env.VERCEL) && url.startsWith("file:");

// libSQL no crea carpetas: aseguramos la del archivo antes de abrir la conexión
if (url.startsWith("file:") && !missingRemoteDb) {
  const path = url.slice(5);
  if (path.includes("/")) mkdirSync(path.slice(0, path.lastIndexOf("/")), { recursive: true });
}

const globalForDb = globalThis as unknown as { __mmClient?: Client; __mmReady?: Promise<void> };
const client =
  globalForDb.__mmClient ??
  createClient({ url: missingRemoteDb ? "file::memory:" : url, authToken: process.env.DATABASE_AUTH_TOKEN });
if (process.env.NODE_ENV !== "production") globalForDb.__mmClient = client;

export const db = drizzle(client, { schema });

/** Bootstrap sin fricción para desarrollo. En producción usar `npm run db:migrate`. */
export function ensureSchema(): Promise<void> {
  globalForDb.__mmReady ??= (async () => {
    if (missingRemoteDb) {
      throw new Error(
        "Falta la base de datos: en Vercel configurá DATABASE_URL (libsql://…) y DATABASE_AUTH_TOKEN de Turso en Settings → Environment Variables.",
      );
    }
    await client.execute(`CREATE TABLE IF NOT EXISTS mind_maps (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      data TEXT NOT NULL,
      node_count INTEGER NOT NULL DEFAULT 1,
      version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`);
    await client.execute(`CREATE INDEX IF NOT EXISTS mind_maps_updated_idx ON mind_maps (updated_at DESC)`);
  })();
  return globalForDb.__mmReady;
}
