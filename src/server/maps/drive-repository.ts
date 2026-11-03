import "server-only";
import { createDefaultDoc } from "@/features/mindmap/model/factory";
import { mindMapDocSchema } from "@/features/mindmap/model/schema";
import type { MindMapDoc, MindMapRecord, MindMapSummary } from "@/features/mindmap/model/types";
import { GOOGLE } from "../auth/config";
import { accessToken, AuthExpiredError, type Session } from "../auth/session";
import type { MapsRepository, SaveResult } from "./types";

/**
 * Mapas guardados en el Google Drive del usuario.
 *
 * - Cada mapa es un archivo "<título>.mindmap.json" dentro de la carpeta
 *   "Mindmap Studio" de su Drive (la crea la app la primera vez).
 * - Se pide sólo el permiso `drive.file`: la app ve únicamente los archivos que
 *   ella misma creó, nunca el resto del Drive.
 * - El contenido es el mismo formato que "Exportar", así que el archivo se
 *   puede descargar de Drive e importar en cualquier otra instalación.
 * - Para no pisar cambios entre pestañas o dispositivos se guarda un número de
 *   versión en las propiedades del archivo (appProperties.version).
 */

const FOLDER_NAME = "Mindmap Studio";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const SUFFIX = ".mindmap.json";
const TAG = "mindmapStudio";

interface DriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
  trashed?: boolean;
  appProperties?: Record<string, string>;
}

interface StoredFile {
  format: "mindmap-studio";
  title: string;
  version: number;
  savedAt: string;
  doc: MindMapDoc;
}

export class DriveError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const titleOf = (f: DriveFile) => (f.name.endsWith(SUFFIX) ? f.name.slice(0, -SUFFIX.length) : f.name) || "Mapa sin título";
const fileName = (title: string) => `${(title.trim() || "Mapa sin título").replace(/[\\/]/g, "-")}${SUFFIX}`;

// carpeta de cada usuario, para no buscarla en cada guardado
const globalFolders = globalThis as unknown as { __mmFolders?: Map<string, string> };
const folderCache = (globalFolders.__mmFolders ??= new Map());

export function driveRepository(session: Session): MapsRepository {
  async function call(url: string, init: RequestInit = {}): Promise<Response> {
    const send = (token: string) => fetch(url, { ...init, headers: { ...init.headers, authorization: `Bearer ${token}` } });
    let res = await send(await accessToken(session));
    // Google puede invalidar el acceso antes de la hora: se pide uno nuevo y se reintenta una vez.
    // Si tampoco se puede renovar, accessToken avisa que hay que volver a iniciar sesión.
    if (res.status === 401) res = await send(await accessToken(session, { force: true }));
    if (res.status === 401) throw new AuthExpiredError();
    return res;
  }
  async function callJson<T>(url: string, init: RequestInit = {}): Promise<T> {
    const res = await call(url, init);
    if (!res.ok) throw new DriveError(res.status, `Google Drive respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json() as Promise<T>;
  }

  /** Subida en un solo pedido: propiedades del archivo + contenido JSON */
  function multipart(meta: object, content: string) {
    const boundary = `mm${Math.random().toString(36).slice(2)}`;
    const body =
      `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
      `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${content}\r\n--${boundary}--`;
    return { body, headers: { "content-type": `multipart/related; boundary=${boundary}` } };
  }

  async function folderId(): Promise<string> {
    const cached = folderCache.get(session.sub);
    if (cached) return cached;
    const q = `mimeType='${FOLDER_MIME}' and appProperties has { key='${TAG}' and value='folder' } and trashed=false`;
    const found = await callJson<{ files: DriveFile[] }>(`${GOOGLE.drive}/files?${new URLSearchParams({ q, fields: "files(id)", pageSize: "1" })}`);
    let id = found.files[0]?.id;
    if (!id) {
      const created = await callJson<DriveFile>(`${GOOGLE.drive}/files?fields=id`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME, appProperties: { [TAG]: "folder" } }),
      });
      id = created.id;
    }
    folderCache.set(session.sub, id);
    return id;
  }

  async function meta(id: string): Promise<DriveFile | null> {
    if (!/^[\w-]{10,}$/.test(id)) return null;
    const res = await call(`${GOOGLE.drive}/files/${id}?fields=id,name,modifiedTime,trashed,appProperties`);
    // 404 = no existe o no es de esta app (con drive.file Google responde 404 para archivos ajenos).
    // Un 403 NO es "no existe": son límites de pedidos, permisos o la API deshabilitada.
    if (res.status === 404) return null;
    if (!res.ok) throw new DriveError(res.status, `Google Drive respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const f = (await res.json()) as DriveFile;
    return f.trashed || f.appProperties?.[TAG] !== "map" ? null : f;
  }

  async function getMap(id: string): Promise<MindMapRecord | null> {
    const f = await meta(id);
    if (!f) return null;
    const res = await call(`${GOOGLE.drive}/files/${id}?alt=media`);
    if (res.status === 404) return null;
    if (!res.ok) throw new DriveError(res.status, `Google Drive respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const raw = (await res.json().catch(() => null)) as Partial<StoredFile> | null;
    const doc = mindMapDocSchema.safeParse(raw?.doc);
    if (!doc.success) return null; // el archivo se editó a mano y ya no es un mapa válido
    return {
      id: f.id,
      title: titleOf(f),
      version: Number(f.appProperties?.version ?? raw?.version ?? 1),
      doc: doc.data,
      updatedAt: f.modifiedTime ?? new Date().toISOString(),
      storage: "drive",
    };
  }

  const contentOf = (title: string, version: number, doc: MindMapDoc): string =>
    JSON.stringify({ format: "mindmap-studio", title, version, savedAt: new Date().toISOString(), doc } satisfies StoredFile);

  return {
    storage: "drive",

    async listMaps(): Promise<MindMapSummary[]> {
      const q = `appProperties has { key='${TAG}' and value='map' } and trashed=false`;
      const res = await callJson<{ files: DriveFile[] }>(
        `${GOOGLE.drive}/files?${new URLSearchParams({ q, fields: "files(id,name,modifiedTime,appProperties)", orderBy: "modifiedTime desc", pageSize: "200" })}`,
      );
      return res.files.map((f) => ({
        id: f.id,
        title: titleOf(f),
        nodeCount: Number(f.appProperties?.nodes ?? 1),
        updatedAt: f.modifiedTime ?? new Date().toISOString(),
      }));
    },

    getMap,

    async createMap(input) {
      const title = (input.title ?? "Mapa sin título").trim() || "Mapa sin título";
      const doc = input.doc ?? createDefaultDoc(title);
      const parent = await folderId();
      const { body, headers } = multipart(
        {
          name: fileName(title),
          mimeType: "application/json",
          parents: [parent],
          appProperties: { [TAG]: "map", version: "1", nodes: String(Object.keys(doc.nodes).length) },
        },
        contentOf(title, 1, doc),
      );
      const f = await callJson<DriveFile>(`${GOOGLE.upload}/files?uploadType=multipart&fields=id,modifiedTime`, { method: "POST", headers, body });
      return { id: f.id, title, version: 1, doc, updatedAt: f.modifiedTime ?? new Date().toISOString(), storage: "drive" };
    },

    async saveMap(id, input): Promise<SaveResult> {
      const f = await meta(id);
      if (!f) return { ok: false, reason: "not_found" };
      const current = Number(f.appProperties?.version ?? 1);
      if (current !== input.version) {
        const now = await getMap(id);
        return now ? { ok: false, reason: "conflict", current: now } : { ok: false, reason: "not_found" };
      }
      const version = current + 1;
      const { body, headers } = multipart(
        { name: fileName(input.title), appProperties: { version: String(version), nodes: String(Object.keys(input.doc.nodes).length) } },
        contentOf(input.title, version, input.doc),
      );
      const saved = await callJson<DriveFile>(`${GOOGLE.upload}/files/${id}?uploadType=multipart&fields=id,modifiedTime`, {
        method: "PATCH",
        headers,
        body,
      });
      return { ok: true, version, updatedAt: saved.modifiedTime ?? new Date().toISOString() };
    },

    /** Borrar = mandar a la papelera de Drive (se puede recuperar desde ahí durante 30 días) */
    async deleteMap(id) {
      if (!(await meta(id))) return false;
      await callJson(`${GOOGLE.drive}/files/${id}?fields=id`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trashed: true }),
      });
      return true;
    },
  };
}
