import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client-appointments';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import * as path from 'path';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    let dbPath = process.env.DATABASE_URL_APPOINTMENTS;
    if (!dbPath) {
      const absoluteDbPath = path.resolve(process.cwd(), 'apps', 'appointments.db');
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
