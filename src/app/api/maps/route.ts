import { NextResponse } from "next/server";
import { createMapInput } from "@/features/mindmap/model/schema";
import { apiError, currentRepository, loginNeeded } from "@/server/maps/current";

export const dynamic = "force-dynamic";

/** GET /api/maps → lista resumida (sin el documento) ordenada por última edición */
export async function GET() {
  const { repo } = await currentRepository();
  if (!repo) return loginNeeded();
  try {
    return NextResponse.json(await repo.listMaps());
  } catch (err) {
    return apiError(err);
  }
}

/** POST /api/maps { title?, doc? } → crea un mapa vacío o importado desde JSON */
export async function POST(req: Request) {
  const { repo } = await currentRepository();
  if (!repo) return loginNeeded();
  const body = await req.json().catch(() => null);
  const parsed = createMapInput.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Documento inválido", issues: parsed.error.issues }, { status: 422 });
  }
  try {
    return NextResponse.json(await repo.createMap(parsed.data), { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
