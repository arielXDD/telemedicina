import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import proxy from 'express-http-proxy';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS para que el Frontend pueda consumir la API
    app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Acceder a la instancia Express subyacente de NestJS
  app.use(helmet());

  // Acceder a la instancia Express subyacente de NestJS
  const expressApp = app.getHttpAdapter().getInstance();

  // Configurar las rutas del API Gateway hacia los respectivos microservicios
  const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:8001';
  const appointmentServiceUrl = process.env.APPOINTMENT_SERVICE_URL || 'http://localhost:8002';
  const clinicalHistoryServiceUrl = process.env.CLINICAL_HISTORY_SERVICE_URL || 'http://localhost:8003';

  // 1. Redireccionar /auth/* -> Auth Service
  expressApp.use('/auth', proxy(authServiceUrl, {
    proxyReqPathResolver: (req: any) => `/auth${req.url}`,
  }));

  // 2. Redireccionar /appointments/* -> Appointment Service
  expressApp.use('/appointments', proxy(appointmentServiceUrl, {
    proxyReqPathResolver: (req: any) => `/appointments${req.url}`,
  }));

  // 3. Redireccionar /clinical-history/* -> Clinical History Service
  expressApp.use('/clinical-history', proxy(clinicalHistoryServiceUrl, {
    proxyReqPathResolver: (req: any) => `/clinical-history${req.url}`,
  }));

  const port = process.env.GATEWAY_PORT || 8000;
  await app.listen(port);
  console.log(`[API Gateway] Escuchando en: http://localhost:${port}`);
}
bootstrap();
