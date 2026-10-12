import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * 1. Refreshes the Supabase session cookie.
 * 2. Sends signed-out visitors away from /app and /leader.
 * 3. Sets a per-request nonce CSP (Next applies the nonce to its own scripts).
 */
export async function middleware(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const supa = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${supa}`,
    `font-src 'self'`,
    `connect-src 'self' ${supa} ${supa.replace("https://", "wss://")}`,
    `frame-src https://challenges.cloudflare.com`,
    `media-src 'self' ${supa}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    dev ? "" : `upgrade-insecure-requests`,
  ].filter(Boolean).join("; ");

  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-nonce", nonce);
  reqHeaders.set("Content-Security-Policy", csp);

  let res = NextResponse.next({ request: { headers: reqHeaders } });
  const supabase = createServerClient(supa, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: { headers: reqHeaders } });
        list.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, { ...options, httpOnly: true, secure: !dev, sameSite: "lax" }),
        );
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();

  const p = req.nextUrl.pathname;
  if (!user && (p.startsWith("/app") || p.startsWith("/leader"))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", p);
    return NextResponse.redirect(url);
  }

  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (!dev) res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  if (p.startsWith("/app") || p.startsWith("/leader")) res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/cron).*)"],
};
