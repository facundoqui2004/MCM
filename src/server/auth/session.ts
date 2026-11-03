import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { GOOGLE, googleConfig } from "./config";

/**
 * Sesión sin base de datos: los datos del usuario y su token de Google viajan
 * en una cookie httpOnly cifrada con AES-256-GCM (clave derivada de AUTH_SECRET).
 * El navegador no puede leerla ni modificarla.
 */

export interface Session {
  /** id de la cuenta de Google */
  sub: string;
  email: string;
  name: string;
  picture?: string;
  /** refresh token: permite renovar el acceso a Drive sin volver a iniciar sesión */
  rt: string;
  /** access token vigente y cuándo vence (ms) */
  at?: string;
  exp?: number;
}

export const SESSION_COOKIE = "mm_session";
const SESSION_DAYS = 180;

const key = () => createHash("sha256").update(googleConfig()?.secret ?? "").digest();

export function seal(data: unknown): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(JSON.stringify(data), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

export function unseal<T>(token: string | undefined): T | null {
  if (!token) return null;
  try {
    const [iv, tag, body] = token.split(".").map((p) => Buffer.from(p, "base64url"));
    const d = createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return JSON.parse(Buffer.concat([d.update(body), d.final()]).toString("utf8")) as T;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 24 * 3600,
};

export async function getSession(): Promise<Session | null> {
  if (!googleConfig()) return null;
  return unseal<Session>((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Guarda la sesión. Sólo funciona en rutas de API (las páginas no pueden escribir cookies). */
export async function writeSession(s: Session) {
  try {
    (await cookies()).set(SESSION_COOKIE, seal(s), sessionCookieOptions);
  } catch {
    // dentro de una página (Server Component): el token renovado queda en memoria
  }
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** La cuenta de Google ya no autoriza a la app (revocó el permiso o venció): hay que volver a entrar */
export class AuthExpiredError extends Error {
  constructor() {
    super("La sesión de Google venció. Volvé a iniciar sesión");
  }
}

// Tokens renovados en memoria, para no pedir uno nuevo en cada render de página
const globalTokens = globalThis as unknown as { __mmTokens?: Map<string, { at: string; exp: number }> };
const tokenCache = (globalTokens.__mmTokens ??= new Map());

/** Access token vigente para Drive (lo renueva con el refresh token si hace falta) */
export async function accessToken(s: Session, opts: { force?: boolean } = {}): Promise<string> {
  const now = Date.now();
  const cached = tokenCache.get(s.sub);
  if (!opts.force) {
    // el de la memoria del servidor es igual o más nuevo que el de la cookie
    if (cached && cached.exp - now > 60_000) return cached.at;
    if (s.at && s.exp && s.exp - now > 60_000) return s.at;
  }

  const cfg = googleConfig();
  if (!cfg) throw new AuthExpiredError();
  const res = await fetch(GOOGLE.token, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: s.rt,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new AuthExpiredError();
  const t = (await res.json()) as { access_token: string; expires_in: number };
  const fresh = { at: t.access_token, exp: now + t.expires_in * 1000 };
  tokenCache.set(s.sub, fresh);
  await writeSession({ ...s, ...fresh });
  return fresh.at;
}

/** Lo que el navegador puede saber del usuario (nunca los tokens) */
export const publicUser = (s: Session) => ({ email: s.email, name: s.name, picture: s.picture });
export type PublicUser = ReturnType<typeof publicUser>;
