import { NextResponse } from "next/server";
import { saveMapInput } from "@/features/mindmap/model/schema";
import { deleteMap, getMap, saveMap } from "@/server/maps/repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/maps/:id → { id, title, version, doc, updatedAt } */
export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  const map = await getMap(id);
  return map ? NextResponse.json(map) : NextResponse.json({ error: "Mapa no encontrado" }, { status: 404 });
}

/**
 * PUT /api/maps/:id { title, doc, version }
 * 200 → { version, updatedAt }
 * 409 → { error, current }  (otra sesión guardó antes: el cliente decide cómo resolver)
 * 422 → documento inválido
 */
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const parsed = saveMapInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Documento inválido", issues: parsed.error.issues }, { status: 422 });
  }
  const res = await saveMap(id, parsed.data);
  if (res.ok) return NextResponse.json({ version: res.version, updatedAt: res.updatedAt });
  if (res.reason === "conflict")
    return NextResponse.json({ error: "Conflicto de versión", current: res.current }, { status: 409 });
  return NextResponse.json({ error: "Mapa no encontrado" }, { status: 404 });
}

/** DELETE /api/maps/:id */
export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params;
  return (await deleteMap(id))
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Mapa no encontrado" }, { status: 404 });
}
