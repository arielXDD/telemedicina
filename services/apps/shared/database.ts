import { Pool, PoolConfig } from 'pg';

export function createPostgresPool(serviceName: string, serviceUrlEnv?: string): Pool {
  const connectionString =
    (serviceUrlEnv ? process.env[serviceUrlEnv] : undefined) ||
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(`[${serviceName}] DATABASE_URL no esta definida.`);
  }

  const poolConfig: PoolConfig = { connectionString };
  const sslRequested = process.env.DATABASE_SSL === 'true';
  const looksLikeSupabase =
    connectionString.includes('supabase.co') ||
    connectionString.includes('pooler.supabase.com');

  if (sslRequested || looksLikeSupabase) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  return new Pool(poolConfig);
}
