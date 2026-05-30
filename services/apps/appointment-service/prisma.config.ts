import { PrismaConfig } from '@prisma/config';
export default {
  earlyAccess: true,
  schema: 'prisma/schema.prisma',
  datasource: {
    url:
      process.env.APPOINTMENT_DATABASE_URL ||
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/postgres?schema=appointments',
  },
} satisfies PrismaConfig;
