import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthServiceController } from './auth-service.controller';
import { AuthServiceService } from './auth-service.service';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    JwtModule.register({
      secret: (() => {
        if (!process.env.JWT_SECRET) {
          throw new Error('FATAL ERROR: JWT_SECRET environment variable is missing');
        }
        return process.env.JWT_SECRET;
      })(),
      signOptions: { expiresIn: '7d' }, // El token dura 7 días
    }),
  ],
  controllers: [AuthServiceController],
  providers: [AuthServiceService, PrismaService],
})
export class AuthServiceModule {}
