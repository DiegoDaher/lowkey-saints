import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ADMIN_PREFIX = "/140210";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/401") {
    const response = NextResponse.next({ status: 401 });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  // 1. Bloquear acceso directo a /admin (devuelve 404 real)
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return NextResponse.rewrite(new URL("/404", request.url), { status: 404 });
  }

  // 2. Calcular la ruta interna real (/140210/login -> /admin/login)
  const internalPath = pathname.replace(ADMIN_PREFIX, "/admin");
  const rewriteUrl = new URL(
    internalPath + request.nextUrl.search,
    request.url
  );

  // Preparamos la respuesta haciendo rewrite interno hacia /admin
  let response = NextResponse.rewrite(rewriteUrl, { request });

  const publicRoute = [
    `${ADMIN_PREFIX}/login`,
    `${ADMIN_PREFIX}/recuperar`,
    `${ADMIN_PREFIX}/restablecer`,
    `${ADMIN_PREFIX}/auth/confirm`,
    `${ADMIN_PREFIX}/sin-acceso`,
  ].includes(pathname);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const denyAccess = () => {
    const denied = NextResponse.rewrite(new URL("/401", request.url), {
      request,
      status: 401,
    });
    denied.headers.set("Cache-Control", "private, no-store");
    response.cookies.getAll().forEach((cookie) => denied.cookies.set(cookie));
    return denied;
  };

  if (!url || !key) return publicRoute ? response : denyAccess();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        // Mantener el rewrite al refrescar cookies de sesión
        response = NextResponse.rewrite(rewriteUrl, { request });
        cookies.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !publicRoute) {
    return denyAccess();
  }

  return response;
}

// 3. El matcher debe escuchar tanto /140210 como /admin (para bloquearlo)
export const config = {
  matcher: ["/401", "/140210/:path*", "/admin/:path*"],
};
