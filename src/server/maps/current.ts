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
    return NextResponse.json({ error: "Google Drive no respondió bien. Probá de nuevo en un momento" }, { status: 502 });
  }
  throw err;
}

export const loginNeeded = () =>
  NextResponse.json({ error: "Iniciá sesión con Google para usar tus mapas", reauth: true }, { status: 401 });
