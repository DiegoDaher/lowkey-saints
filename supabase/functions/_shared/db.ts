import { PrismaClient } from "./generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { postgresTlsConfig } from "./postgres-tls.mjs";
const url = Deno.env.get("APP_DATABASE_URL");
if (!url) throw new Error("APP_DATABASE_URL is required");
export const db = new PrismaClient({
  adapter: new PrismaPg({
    ...postgresTlsConfig(url),
    max: 3,
    connectionTimeoutMillis: 10000,
  }),
  log: ["error"],
});
