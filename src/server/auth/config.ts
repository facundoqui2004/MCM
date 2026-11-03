import "server-only";

/**
 * Configuración de "Iniciar sesión con Google" + guardado en Google Drive.
 *
 * Variables de entorno (ver README → "Google Drive"):
 *   GOOGLE_CLIENT_ID       ID de cliente OAuth (tipo "Aplicación web")
 *   GOOGLE_CLIENT_SECRET   Secreto de ese cliente
 *   AUTH_SECRET            Texto largo al azar: cifra la cookie de sesión
 *   APP_URL                (opcional) URL pública, ej. https://mcm-xi.vercel.app
 *   MAPS_REQUIRE_LOGIN=1   (opcional) sin sesión no se puede usar la app
 *
 * Si faltan las tres primeras, la app funciona como antes: sin cuentas y con
 * los mapas en la base de datos del sitio.
 */

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const SCOPES = ["openid", "email", "profile", DRIVE_SCOPE].join(" ");

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const secret = process.env.AUTH_SECRET;
  if (!clientId || !clientSecret || !secret) return null;
  return { clientId, clientSecret, secret };
}

export const googleEnabled = () => googleConfig() !== null;

/** Sin sesión no se puede crear ni abrir mapas (recomendado al publicar la app) */
export const loginRequired = () => googleEnabled() && process.env.MAPS_REQUIRE_LOGIN === "1";

/**
 * Direcciones de Google. Sólo para pruebas automáticas se pueden apuntar a un
 * servidor falso con GOOGLE_API_BASE_OVERRIDE (nunca en producción).
 */
const override = process.env.NODE_ENV !== "production" || process.env.GOOGLE_API_BASE_OVERRIDE_ALLOW === "1"
  ? process.env.GOOGLE_API_BASE_OVERRIDE
  : undefined;

export const GOOGLE = {
  authorize: `${override ?? "https://accounts.google.com"}/o/oauth2/v2/auth`,
  token: `${override ?? "https://oauth2.googleapis.com"}/token`,
  revoke: `${override ?? "https://oauth2.googleapis.com"}/revoke`,
  drive: `${override ?? "https://www.googleapis.com"}/drive/v3`,
  upload: `${override ?? "https://www.googleapis.com"}/upload/drive/v3`,
};

/** Origen público de la app (para el redirect_uri de Google) */
export function appOrigin(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}
