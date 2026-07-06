import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "auth_token";
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-in-production",
);

const PROTECTED_PREFIXES = ["/learn", "/profile", "/tutor", "/eval"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return redirectToLogin(request, pathname);
  }

  try {
    await jwtVerify(token, SECRET);
    return NextResponse.next();
  } catch {
    return redirectToLogin(request, pathname);
  }
}

function redirectToLogin(request: NextRequest, from: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", from);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/learn/:path*",
    "/profile/:path*",
    "/tutor/:path*",
    "/eval/:path*",
  ],
};
