import { LogOut } from "lucide-react";
import type { PublicUser } from "@/server/auth/session";

/** Logo de Google (marca oficial de "Sign in with Google") */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function GoogleLoginButton({ label = "Iniciar sesión con Google" }: { label?: string }) {
  return (
    // enlace común (no fetch): Google tiene que abrirse en la misma pestaña
    <a href="/api/auth/google/login" className="home-btn mm-google-btn">
      <GoogleMark />
      {label}
    </a>
  );
}

export function AccountBar({ user, notice }: { user: PublicUser | null; notice: string | null }) {
  return (
    <section className={`mm-account ${user ? "is-in" : ""}`} aria-label="Cuenta">
      {notice && (
        <p className="mm-account-notice" role="alert">
          {notice}
        </p>
      )}
      {user ? (
        <div className="mm-account-row">
          {user.picture ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto de perfil de Google
            <img src={user.picture} alt="" className="mm-avatar" referrerPolicy="no-referrer" />
          ) : (
            <span className="mm-avatar is-initial" aria-hidden>
              {(user.name || user.email).slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="mm-account-who">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="mm-account-out" title="Cerrar sesión en este navegador (tus mapas quedan en tu Drive)">
              <LogOut size={15} />
              Cerrar sesión
            </button>
          </form>
        </div>
      ) : (
        <div className="mm-account-row">
          <div className="mm-account-who">
            <strong>Guardá tus mapas en tu Google Drive</strong>
            <span>Así los tenés en cualquier compu y son solo tuyos. Sin cuenta, quedan guardados en este sitio.</span>
          </div>
          <GoogleLoginButton />
        </div>
      )}
    </section>
  );
}

/** Pantalla de entrada cuando la app exige cuenta (MAPS_REQUIRE_LOGIN=1) */
export function LoginHero({ notice }: { notice: string | null }) {
  return (
    <section className="mm-login-hero">
      <h1>Mindmap Studio</h1>
      <p>Mapas mentales para estudiar y repasar. Tus mapas se guardan en tu propio Google Drive.</p>
      {notice && (
        <p className="mm-account-notice" role="alert">
          {notice}
        </p>
      )}
      <GoogleLoginButton label="Entrar con Google" />
      <small>Sólo pedimos acceso a los archivos que crea la app: no vemos el resto de tu Drive.</small>
    </section>
  );
}
