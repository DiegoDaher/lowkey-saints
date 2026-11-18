import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const publicRoute = [
    "/admin/login",
    "/admin/recuperar",
    "/admin/restablecer",
    "/admin/auth/confirm",
    "/admin/sin-acceso",
  ].includes(request.nextUrl.pathname);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response; // Server guards fail closed with a retryable error.
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
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
    const redirect = NextResponse.redirect(
      new URL("/admin/login", request.url)
    );
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  return response;
}
export const config = { matcher: ["/admin/:path*"] };
