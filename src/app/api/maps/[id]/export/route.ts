import { NextResponse } from "next/server";
import type { ExportFile } from "@/features/mindmap/model/schema";
import { getMap } from "@/server/maps/repository";

export const dynamic = "force-dynamic";

/** GET /api/maps/:id/export → descarga el .mindmap.json (mismo formato que el botón del dock) */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const map = await getMap(id);
  if (!map) return NextResponse.json({ error: "Mapa no encontrado" }, { status: 404 });
  const file: ExportFile = { format: "mindmap-studio", title: map.title, exportedAt: new Date().toISOString(), doc: map.doc };
  const name = map.title.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase() || "mapa";
  return new NextResponse(JSON.stringify(file, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${name}.mindmap.json"`,
    },
  });
}
