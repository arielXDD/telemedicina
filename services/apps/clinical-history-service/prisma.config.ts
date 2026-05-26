import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL_CLINICAL_HISTORY || process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/telemed_clinical_history?schema=public",
  },
});
