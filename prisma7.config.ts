import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Path is relative to the project root. For Supabase, point the CLI at the direct URL (design §4, Option C).
    url: process.env.DATABASE_URL,
  },
});
