import "dotenv/config";
import { defineConfig } from "prisma/config";
import { fileURLToPath } from "node:url";
const direct = process.env.DIRECT_URL
  ? new URL(process.env.DIRECT_URL)
  : undefined;
if (direct && !["localhost", "127.0.0.1", "[::1]"].includes(direct.hostname)) {
  direct.searchParams.set("sslmode", "require");
  direct.searchParams.set("sslaccept", "strict");
  direct.searchParams.set(
    "sslcert",
    fileURLToPath(new URL("./docs/prod-ca-2021.crt", import.meta.url))
  );
}
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: direct?.toString() },
});
