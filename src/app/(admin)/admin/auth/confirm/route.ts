import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/server/auth/supabase";

export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const code = request.nextUrl.searchParams.get("code");
  if (code || (token_hash && type === "recovery")) {
    try {
      const client = await supabaseServer();
      const { error } = code
        ? await client.auth.exchangeCodeForSession(code)
        : await client.auth.verifyOtp({
            token_hash: token_hash!,
            type: "recovery",
          });
      if (!error)
        return NextResponse.redirect(
          new URL("/140210/restablecer", request.url)
        );
    } catch {
      /* Never expose verification details or tokens. */
    }
  }
  return NextResponse.redirect(
    new URL("/140210/login?enlace=invalido", request.url)
  );
}
