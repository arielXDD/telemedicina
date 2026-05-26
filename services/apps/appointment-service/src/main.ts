import { NestFactory } from '@nestjs/core';
import { AppointmentServiceModule } from './appointment-service.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppointmentServiceModule);
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  app.enableCors();

  const port = process.env.APPOINTMENT_SERVICE_PORT || 8002;
  await app.listen(port);
  console.log(`[Appointment Service] Microservicio corriendo en: http://localhost:${port}`);
}
bootstrap();
