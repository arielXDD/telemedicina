import { Module } from '@nestjs/common';
import { AppointmentServiceController } from './appointment-service.controller';
import { AppointmentServiceService } from './appointment-service.service';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [AppointmentServiceController],
  providers: [AppointmentServiceService, PrismaService],
})
export class AppointmentServiceModule {}
