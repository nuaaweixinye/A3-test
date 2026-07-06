import { NextResponse } from "next/server";
import { serializeClearCookie } from "@/backend/auth/session";

export const runtime = "nodejs";

export async function POST() {
  const headers = new Headers();
  headers.append("Set-Cookie", serializeClearCookie());
  return NextResponse.json({ ok: true }, { headers });
}
