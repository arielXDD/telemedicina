import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client-auth';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import * as path from 'path';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    let dbPath = process.env.DATABASE_URL_AUTH;
    if (!dbPath) {
      const absoluteDbPath = path.resolve(process.cwd(), 'apps', 'auth.db');
      dbPath = `file:${absoluteDbPath}`;
    }
    const adapter = new PrismaBetterSqlite3({ url: dbPath });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
