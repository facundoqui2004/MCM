import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { appOrigin, GOOGLE, googleConfig, SCOPES } from "@/server/auth/config";
import { OAUTH_COOKIE, type OAuthState } from "@/server/auth/oauth-state";
import { seal } from "@/server/auth/session";

export const dynamic = "force-dynamic";


/**
 * GET /api/auth/google/login?returnTo=/map/x&popup=1
 * Lleva a la pantalla de Google para elegir la cuenta y dar permiso a Drive.
 * `consent=1` fuerza a Google a mostrar el permiso de nuevo (hace falta para
 * recibir un refresh token si ya se había autorizado antes).
 */
export async function GET(req: Request) {
  const cfg = googleConfig();
  if (!cfg) return NextResponse.json({ error: "El inicio de sesión con Google no está configurado" }, { status: 404 });
  const url = new URL(req.url);
  const raw = url.searchParams.get("returnTo") ?? "/";
  // sólo rutas internas: evita usar el login para redirigir a otro sitio
  const returnTo = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  const st: OAuthState = {
    state: randomBytes(16).toString("base64url"),
    returnTo,
    popup: url.searchParams.get("popup") === "1",
    consent: url.searchParams.get("consent") === "1",
  };
  const auth = new URL(GOOGLE.authorize);
  auth.search = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: `${appOrigin(req)}/api/auth/google/callback`,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    include_granted_scopes: "true",
    state: st.state,
    prompt: st.consent ? "consent select_account" : "select_account",
  }).toString();
  const res = NextResponse.redirect(auth);
  res.cookies.set(OAUTH_COOKIE, seal(st), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
