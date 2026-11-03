import "server-only";
import { NextResponse } from "next/server";
import { loginRequired } from "../auth/config";
import { AuthExpiredError, getSession, type Session } from "../auth/session";
import { driveRepository, DriveError } from "./drive-repository";
import { localRepository } from "./repository";
import type { MapsRepository } from "./types";

/**
 * Elige dónde guardar según quién está usando la app:
 * - con sesión de Google → su Google Drive
 * - sin sesión → la base de datos del sitio (salvo que MAPS_REQUIRE_LOGIN=1)
 */
export async function currentRepository(): Promise<{ repo: MapsRepository | null; session: Session | null }> {
  const session = await getSession();
  if (session) return { repo: driveRepository(session), session };
  return { repo: loginRequired() ? null : localRepository, session: null };
}

/** Respuestas de error claras para las rutas de la API */
export function apiError(err: unknown) {
  if (err instanceof AuthExpiredError)
    return NextResponse.json({ error: err.message, reauth: true }, { status: 401 });
  if (err instanceof DriveError) {
    console.error(err);
    return NextResponse.json({ error: driveHint(err) }, { status: 502 });
  }
  throw err;
}

/** Traduce los errores típicos de Google Drive a algo que se pueda resolver */
function driveHint(err: DriveError): string {
  const m = err.message;
  if (/accessNotConfigured|has not been used|is disabled|SERVICE_DISABLED/i.test(m))
    return "La API de Google Drive no está habilitada en el proyecto de Google Cloud. Habilitala en APIs y servicios → Biblioteca → Google Drive API y probá de nuevo en unos minutos";
  if (/insufficientPermissions|insufficient authentication scopes|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(m))
    return "Falta el permiso de Google Drive. Cerrá sesión y volvé a entrar dejando marcada la casilla de Drive";
  if (err.status === 429 || /rateLimit|userRateLimit/i.test(m))
    return "Google Drive está recibiendo demasiados pedidos. Probá de nuevo en un minuto";
  if (/storageQuotaExceeded/i.test(m)) return "Tu Google Drive está lleno: liberá espacio para guardar mapas";
  return `Google Drive no respondió bien (error ${err.status}). Probá de nuevo en un momento`;
}

export const loginNeeded = () =>
  NextResponse.json({ error: "Iniciá sesión con Google para usar tus mapas", reauth: true }, { status: 401 });
