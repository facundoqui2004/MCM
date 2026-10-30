import { NextResponse } from "next/server";
import { createMapInput } from "@/features/mindmap/model/schema";
import { createMap, listMaps } from "@/server/maps/repository";

export const dynamic = "force-dynamic";

/** GET /api/maps → lista resumida (sin el documento) ordenada por última edición */
export async function GET() {
  return NextResponse.json(await listMaps());
}

/** POST /api/maps { title?, doc? } → crea un mapa vacío o importado desde JSON */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = createMapInput.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Documento inválido", issues: parsed.error.issues }, { status: 422 });
  }
  const created = await createMap(parsed.data);
  return NextResponse.json(created, { status: 201 });
}
