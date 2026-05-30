import { spawnSync } from 'node:child_process';

const services = [
  {
    env: 'AUTH_DATABASE_URL',
    schema: 'apps/auth-service/prisma/schema.prisma',
    defaultUrl: 'postgresql://postgres:postgres@localhost:5432/postgres?schema=auth',
  },
  {
    env: 'APPOINTMENT_DATABASE_URL',
    schema: 'apps/appointment-service/prisma/schema.prisma',
    defaultUrl: 'postgresql://postgres:postgres@localhost:5432/postgres?schema=appointments',
  },
  {
    env: 'CLINICAL_HISTORY_DATABASE_URL',
    schema: 'apps/clinical-history-service/prisma/schema.prisma',
    defaultUrl: 'postgresql://postgres:postgres@localhost:5432/postgres?schema=clinical_history',
  },
];

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

for (const service of services) {
  const url = process.env[service.env] || process.env.DATABASE_URL || service.defaultUrl;
  const result = spawnSync(
    npx,
    ['prisma', 'db', 'push', '--schema', service.schema, '--url', url],
    { stdio: 'inherit' },
  );

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
