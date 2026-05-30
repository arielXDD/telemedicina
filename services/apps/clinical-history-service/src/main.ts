import { NestFactory } from '@nestjs/core';
import { ClinicalHistoryServiceModule } from './clinical-history-service.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(ClinicalHistoryServiceModule);
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  

  const port = process.env.CLINICAL_HISTORY_SERVICE_PORT || 8003;
  await app.listen(port);
  console.log(`[Clinical History Service] Microservicio corriendo en: http://localhost:${port}`);
}
bootstrap();
