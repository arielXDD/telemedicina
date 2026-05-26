import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as proxy from 'express-http-proxy';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS para que el Frontend pueda consumir la API
  app.enableCors();

  // Acceder a la instancia Express subyacente de NestJS
  const expressApp = app.getHttpAdapter().getInstance();

  // Configurar las rutas del API Gateway hacia los respectivos microservicios
  
  // 1. Redireccionar /auth/* -> Auth Service (puerto 8001)
  expressApp.use('/auth', proxy('http://localhost:8001', {
    proxyReqPathResolver: (req) => `/auth${req.url}`,
  }));

  // 2. Redireccionar /appointments/* -> Appointment Service (puerto 8002)
  expressApp.use('/appointments', proxy('http://localhost:8002', {
    proxyReqPathResolver: (req) => `/appointments${req.url}`,
  }));

  // 3. Redireccionar /clinical-history/* -> Clinical History Service (puerto 8003)
  expressApp.use('/clinical-history', proxy('http://localhost:8003', {
    proxyReqPathResolver: (req) => `/clinical-history${req.url}`,
  }));

  const port = process.env.GATEWAY_PORT || 8000;
  await app.listen(port);
  console.log(`[API Gateway] Escuchando en: http://localhost:${port}`);
}
bootstrap();
