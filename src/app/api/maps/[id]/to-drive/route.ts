import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { apiError, loginNeeded } from "@/server/maps/current";
import { driveRepository } from "@/server/maps/drive-repository";
import { localRepository } from "@/server/maps/repository";

export const dynamic = "force-dynamic";

/**
 * POST /api/maps/:id/to-drive → copia un mapa guardado en el sitio (sin cuenta)
 * al Google Drive del usuario. El original queda donde estaba.
 */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return loginNeeded();
  try {
    const map = await localRepository.getMap(id);
    if (!map) return NextResponse.json({ error: "Mapa no encontrado" }, { status: 404 });
    const created = await driveRepository(session).createMap({ title: map.title, doc: map.doc });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
