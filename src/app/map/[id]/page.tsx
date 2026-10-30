import { notFound } from "next/navigation";
import { MindMapEditor } from "@/features/mindmap/components/mind-map-editor";
import { getMap } from "@/server/maps/repository";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const map = await getMap((await params).id);
  return { title: map ? `${map.title} — Mindmap Studio` : "Mapa no encontrado" };
}

export default async function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const map = await getMap(id);
  if (!map) notFound();
  // key: al navegar entre mapas se remonta el editor y se recarga el store
  return <MindMapEditor key={map.id} initial={map} />;
}
