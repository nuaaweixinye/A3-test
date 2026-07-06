import { NextResponse } from "next/server";
import { prisma } from "@/backend/auth/prisma";
import { hashPassword } from "@/backend/auth/password";
import { signToken } from "@/backend/auth/jwt";
import { serializeAuthCookie } from "@/backend/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: "用户名和密码不能为空" }, { status: 400 });
  }
  if (username.length < 2 || username.length > 20) {
    return NextResponse.json({ error: "用户名长度需 2-20 字符" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "密码至少 6 个字符" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "用户名已存在" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: { username, passwordHash: await hashPassword(password) },
  });

  const token = await signToken({ sub: user.id, username: user.username });
  const headers = new Headers();
  headers.append("Set-Cookie", serializeAuthCookie(token));

  return NextResponse.json(
    { user: { id: user.id, username: user.username } },
    { headers },
  );
}
