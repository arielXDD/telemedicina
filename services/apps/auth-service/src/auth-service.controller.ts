import { Controller, Post, Body, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { AuthServiceService } from './auth-service.service';
import { RegisterDto, LoginDto } from './dtos/auth.dto';

@Controller('auth')
export class AuthServiceController {
  constructor(private readonly authService: AuthServiceService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('validate')
  async validate(@Body() body: { token?: string }, @Headers('authorization') authHeader?: string) {
    let token = body.token;
    
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      throw new UnauthorizedException('Token no proporcionado.');
    }

    return this.authService.validateToken(token);
  }

  @Get('doctors')
  async getDoctors() {
    return this.authService.getDoctors();
  }
}
