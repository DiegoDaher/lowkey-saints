// Local browser-test Auth stub. Never used by the application or deployment.
import { createServer } from "node:http";
const user = {
  id: "10000000-0000-4000-8000-000000000099",
  aud: "authenticated",
  role: "authenticated",
  email: "operator@example.test",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-11-11T00:00:00Z",
};
const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 86400 })}.test-signature`;
createServer((req, res) => {
  res.setHeader(
    "Access-Control-Allow-Origin",
    req.headers.origin || "http://localhost:3102"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version"
  );
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }
  if (req.url.startsWith("/auth/v1/token")) {
    res.end(
      JSON.stringify({
        access_token: token,
        refresh_token: "test-refresh",
        expires_in: 86400,
        token_type: "bearer",
        user,
      })
    );
  } else if (
    req.url.startsWith("/auth/v1/user") &&
    req.headers.authorization === `Bearer ${token}`
  ) {
    res.end(JSON.stringify(user));
  } else if (req.url === "/health") {
    res.end("{}");
  } else {
    res.writeHead(401).end(JSON.stringify({ message: "Invalid test session" }));
  }
}).listen(55440, "127.0.0.1");
