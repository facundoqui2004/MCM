import { notFound, redirect } from "next/navigation";
import { MindMapEditor } from "@/features/mindmap/components/mind-map-editor";
import { AuthExpiredError } from "@/server/auth/session";
import { currentRepository } from "@/server/maps/current";

export const dynamic = "force-dynamic";

async function load(id: string) {
  const { repo } = await currentRepository();
  if (!repo) redirect("/");
  try {
    return await repo.getMap(id);
  } catch (err) {
    if (err instanceof AuthExpiredError) redirect("/?login=expirado");
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const map = await load((await params).id);
  return { title: map ? `${map.title} — Mindmap Studio` : "Mapa no encontrado" };
}

export default async function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const map = await load(id);
  if (!map) notFound();
  // key: al navegar entre mapas se remonta el editor y se recarga el store
  return <MindMapEditor key={map.id} initial={map} />;
}
