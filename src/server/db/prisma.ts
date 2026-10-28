// Application data now lives behind Supabase Edge Functions.
// Prisma must never be imported into the Next.js browser bundle.
export { api } from "@/lib/api";
