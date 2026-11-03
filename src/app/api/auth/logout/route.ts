import { NextResponse } from "next/server";
import { appOrigin } from "@/server/auth/config";
import { SESSION_COOKIE } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout — cierra la sesión en este navegador (los mapas quedan en Drive) */
export async function POST(req: Request) {
  const res = NextResponse.redirect(`${appOrigin(req)}/`, { status: 303 });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
