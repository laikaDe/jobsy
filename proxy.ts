import { NextResponse, type NextRequest } from "next/server";

/** Password from an `Authorization: Basic …` header (username ignored), or null. */
function basicAuthPassword(header: string | null): string | null {
  const [scheme, encoded] = (header ?? "").split(" ");
  if (scheme?.toLowerCase() !== "basic" || !encoded) return null;
  try {
    const decoded = atob(encoded);
    const sep = decoded.indexOf(":"); // passwords may contain ":", usernames can't
    return sep === -1 ? null : decoded.slice(sep + 1);
  } catch {
    return null;
  }
}

/** Optional single-password gate. No APP_PASSWORD → open. Covers pages, Server Actions and /api. */
export function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();
  if (basicAuthPassword(request.headers.get("authorization")) === password) return NextResponse.next();
  // API clients (the browser extension) get plain JSON with no challenge, so Chrome never shows a login dialog.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Wrong or missing password" }, { status: 401 });
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="jobsy", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
