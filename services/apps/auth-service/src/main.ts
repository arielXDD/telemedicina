import { NestFactory } from '@nestjs/core';
import { AuthServiceModule } from './auth-service.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AuthServiceModule);
  
  // Habilitar validación global de DTOs
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // Habilitar CORS
  app.enableCors();

  const port = process.env.AUTH_SERVICE_PORT || 8001;
  await app.listen(port);
  console.log(`[Auth Service] Microservicio corriendo en: http://localhost:${port}`);
}
bootstrap();
