import Link from "next/link";
import { CopyToDriveButton, DeleteMapButton, NewMapButtons } from "@/components/map-list-actions";
import { AccountBar, LoginHero } from "@/components/account";
import type { MindMapSummary } from "@/features/mindmap/model/types";
import { googleEnabled, loginRequired } from "@/server/auth/config";
import { AuthExpiredError, publicUser } from "@/server/auth/session";
import { currentRepository } from "@/server/maps/current";
import { localRepository } from "@/server/maps/repository";
import { ThemePicker } from "@/features/theme/theme-picker";

export const dynamic = "force-dynamic";

const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
function ago(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [["second", 60], ["minute", 60], ["hour", 24], ["day", 30], ["month", 12]];
  let v = diff;
  for (const [unit, size] of steps) {
    if (Math.abs(v) < size) return rtf.format(Math.round(v), unit);
    v /= size;
  }
  return rtf.format(Math.round(v), "year");
}

const LOGIN_ERRORS: Record<string, string> = {
  cancelado: "No se completó el inicio de sesión con Google.",
  expirado: "Tu sesión de Google venció. Volvé a iniciar sesión para ver tus mapas.",
  "sin-drive": "Para guardar tus mapas hace falta permitir el acceso a Google Drive. Volvé a intentarlo y dejá marcada esa casilla.",
  google: "Google no respondió bien. Probá de nuevo en un momento.",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ login?: string }> }) {
  const { login } = await searchParams;
  const { repo, session } = await currentRepository();
  const google = googleEnabled();
  let maps: MindMapSummary[] = [];
  let expired = login === "expirado";
  let driveDown = false;
  if (repo) {
    try {
      maps = await repo.listMaps();
    } catch (err) {
      if (err instanceof AuthExpiredError) expired = true;
      else if (session) driveDown = true;
      else throw err;
    }
  }
  // Con sesión: los mapas que quedaron guardados en el sitio se pueden copiar al Drive
  const siteMaps = session && !expired ? await localRepository.listMaps().catch(() => []) : [];
  const loggedIn = !!session && !expired;
  const notice = login && LOGIN_ERRORS[login] ? LOGIN_ERRORS[login] : expired ? LOGIN_ERRORS.expirado : null;

  if (!repo || (loginRequired() && !loggedIn)) {
    return (
      <main className="home">
        <ThemePicker className="home-theme" />
        <LoginHero notice={notice} />
      </main>
    );
  }

  return (
    <main className="home">
      <ThemePicker className="home-theme" />
      {google && <AccountBar user={loggedIn ? publicUser(session) : null} notice={notice} />}
      <header className="home-head">
        <div>
          <h1>Tus mapas</h1>
          <p>
            {loggedIn
              ? "Se guardan solos en tu Google Drive, en la carpeta Mindmap Studio."
              : "Pensá en ramas. Cada idea nueva está a una tecla de distancia."}
          </p>
        </div>
        {!expired && <NewMapButtons showSample={maps.length === 0} />}
      </header>

      {driveDown ? (
        <section className="home-empty">
          <p>No pudimos leer tus mapas de Google Drive. Recargá la página en un momento.</p>
        </section>
      ) : expired ? null : maps.length === 0 ? (
        <section className="home-empty">
          <p>Todavía no hay mapas. Creá uno desde una idea central o abrí el ejemplo para ver cómo se ramifica.</p>
        </section>
      ) : (
        <ul className="home-list">
          {maps.map((m) => (
            <li key={m.id} className="home-item">
              <Link href={`/map/${m.id}`} className="home-row">
                <span className="home-row-title">{m.title}</span>
                <span className="home-row-meta">
                  {m.nodeCount} {m.nodeCount === 1 ? "idea" : "ideas"}
                </span>
                <span className="home-row-meta">editado {ago(m.updatedAt)}</span>
              </Link>
              <DeleteMapButton id={m.id} title={m.title} toTrash={loggedIn} />
            </li>
          ))}
        </ul>
      )}

      {siteMaps.length > 0 && (
        <section className="home-site" aria-labelledby="site-maps">
          <h2 id="site-maps">Mapas guardados en el sitio</h2>
          <p>Son los que hiciste sin iniciar sesión. Copialos a tu Drive para tenerlos con tu cuenta; el original queda acá.</p>
          <ul className="home-list">
            {siteMaps.map((m) => (
              <li key={m.id} className="home-item">
                <div className="home-row is-static">
                  <span className="home-row-title">{m.title}</span>
                  <span className="home-row-meta">
                    {m.nodeCount} {m.nodeCount === 1 ? "idea" : "ideas"}
                  </span>
                  <span className="home-row-meta">editado {ago(m.updatedAt)}</span>
                </div>
                <CopyToDriveButton id={m.id} title={m.title} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
