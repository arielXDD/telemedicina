import { Controller, Get, Post, Query, Body, HttpCode } from '@nestjs/common';
import * as twilio from 'twilio';

@Controller()
export class AppController {
  @Get('health')
  getHealth() {
    return { status: 'OK', services: 'API Gateway is online.' };
  }

  @Post('video/token')
  @HttpCode(200)
  getVideoToken(@Body() body: { identity: string; room: string }) {
    const identity = body.identity || `Usuario_${Math.floor(Math.random() * 1000)}`;
    const room = body.room || 'ConsultaGeneral';

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKey = process.env.TWILIO_API_KEY;
    const apiSecret = process.env.TWILIO_API_SECRET;

    if (accountSid && apiKey && apiSecret) {
      try {
        const AccessToken = twilio.jwt.AccessToken;
        const VideoGrant = AccessToken.VideoGrant;

        const token = new AccessToken(accountSid, apiKey, apiSecret, {
          identity,
          ttl: 3600, // 1 hora de validez
        });

        const videoGrant = new VideoGrant({ room });
        token.addGrant(videoGrant);

        return {
          token: token.toJwt(),
          identity,
          room,
          type: 'TWILIO_REAL',
        };
      } catch (error) {
        console.error('Error al generar token real de Twilio:', error);
      }
    }

    // Fallback: Generación de token simulado para desarrollo local sin llaves
    console.log(`[API Gateway] Generando token de videollamada de prueba para: ${identity} en sala: ${room}`);
    return {
      token: `mock_twilio_token_for_${identity}_room_${room}_${Date.now()}`,
      identity,
      room,
      type: 'SIMULADO',
    };
  }
}
