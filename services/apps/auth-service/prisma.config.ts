import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL_AUTH || process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/telemed_auth?schema=public",
  },
});
