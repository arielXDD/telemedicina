import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client-clinical-history';
import { PrismaPg } from '@prisma/adapter-pg';
import { createPostgresPool } from '../../shared/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const pool = createPostgresPool('clinical-history-service', 'CLINICAL_HISTORY_DATABASE_URL');
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
