import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { appOrigin, DRIVE_SCOPE, GOOGLE, googleConfig } from "@/server/auth/config";
import { seal, SESSION_COOKIE, sessionCookieOptions, unseal, type Session } from "@/server/auth/session";
import { OAUTH_COOKIE, type OAuthState } from "@/server/auth/oauth-state";

export const dynamic = "force-dynamic";

/** Datos del usuario dentro del id_token (llega directo de Google por HTTPS) */
function idTokenClaims(idToken: string): { sub: string; email: string; name?: string; picture?: string } {
  return JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
}

/** GET /api/auth/google/callback?code=…&state=… — vuelta desde Google */
export async function GET(req: Request) {
  const cfg = googleConfig();
  const origin = appOrigin(req);
  const url = new URL(req.url);
  const jar = await cookies();
  const st = unseal<OAuthState>(jar.get(OAUTH_COOKIE)?.value);
  const fail = (motivo: string) => NextResponse.redirect(`${origin}/?login=${encodeURIComponent(motivo)}`);

  if (!cfg || !st || st.state !== url.searchParams.get("state")) return fail("expirado");
  if (url.searchParams.get("error")) return fail("cancelado");
  const code = url.searchParams.get("code");
  if (!code) return fail("cancelado");

  const res = await fetch(GOOGLE.token, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: `${origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) return fail("google");
  const t = (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    id_token?: string;
    scope?: string;
  };
  // sin permiso de Drive la app no puede guardar: se vuelve a pedir
  if (t.scope && !t.scope.split(" ").includes(DRIVE_SCOPE)) return fail("sin-drive");
  if (!t.id_token) return fail("google");
  const who = idTokenClaims(t.id_token);

  // Google sólo manda refresh token la primera vez que se autoriza la app.
  // Si no vino y no hay uno guardado de antes, se repite pidiendo el permiso explícito.
  const previous = unseal<Session>(jar.get(SESSION_COOKIE)?.value);
  const rt = t.refresh_token ?? (previous?.sub === who.sub ? previous.rt : undefined);
  if (!rt) {
    if (st.consent) return fail("google");
    const again = new URL(`${origin}/api/auth/google/login`);
    again.search = new URLSearchParams({ returnTo: st.returnTo, consent: "1", ...(st.popup ? { popup: "1" } : {}) }).toString();
    return NextResponse.redirect(again);
  }

  const session: Session = {
    sub: who.sub,
    email: who.email,
    name: who.name ?? who.email,
    picture: who.picture,
    rt,
    at: t.access_token,
    exp: Date.now() + t.expires_in * 1000,
  };
  const out = NextResponse.redirect(st.popup ? `${origin}/auth/listo` : `${origin}${st.returnTo}`);
  out.cookies.set(SESSION_COOKIE, seal(session), sessionCookieOptions);
  out.cookies.delete(OAUTH_COOKIE);
  return out;
}
