import { NextResponse } from "next/server";
import { prisma } from "@/backend/auth/prisma";
import { verifyPassword } from "@/backend/auth/password";
import { signToken } from "@/backend/auth/jwt";
import { serializeAuthCookie } from "@/backend/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: "用户名和密码不能为空" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
  }

  const token = await signToken({ sub: user.id, username: user.username });
  const headers = new Headers();
  headers.append("Set-Cookie", serializeAuthCookie(token));

  return NextResponse.json(
    { user: { id: user.id, username: user.username } },
    { headers },
  );
}
