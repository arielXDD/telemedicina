import { Module } from '@nestjs/common';
import { ClinicalHistoryServiceController } from './clinical-history-service.controller';
import { ClinicalHistoryServiceService } from './clinical-history-service.service';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [ClinicalHistoryServiceController],
  providers: [ClinicalHistoryServiceService, PrismaService],
})
export class ClinicalHistoryServiceModule {}
