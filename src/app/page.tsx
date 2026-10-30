import Link from "next/link";
import { DeleteMapButton, NewMapButtons } from "@/components/map-list-actions";
import { listMaps } from "@/server/maps/repository";
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

export default async function Home() {
  const maps = await listMaps();
  return (
    <main className="home">
      <ThemePicker className="home-theme" />
      <header className="home-head">
        <div>
          <h1>Tus mapas</h1>
          <p>Pensá en ramas. Cada idea nueva está a una tecla de distancia.</p>
        </div>
        <NewMapButtons showSample={maps.length === 0} />
      </header>

      {maps.length === 0 ? (
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
              <DeleteMapButton id={m.id} title={m.title} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
