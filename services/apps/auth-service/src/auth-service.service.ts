import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto, LoginDto } from './dtos/auth.dto';

@Injectable()
export class AuthServiceService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('El correo electrónico ya está registrado.');
    }

    // Lógica especial de registro seguro para médicos
    if (dto.role === 'MEDICO') {
      const officialKey = process.env.DOCTOR_REGISTRATION_KEY || 'MED-SECURE-2026';
      if (!dto.doctorRegisterKey || dto.doctorRegisterKey !== officialKey) {
        throw new UnauthorizedException('La clave de acceso para registro de médicos es incorrecta.');
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const isApproved = dto.role !== 'MEDICO'; // false para médicos, true para pacientes

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        password: hashedPassword,
        name: dto.name,
        role: dto.role,
        specialty: dto.role === 'MEDICO' ? dto.specialty : null,
        licenseNumber: dto.role === 'MEDICO' ? dto.licenseNumber : null,
        isApproved,
      },
    });

    const token = this.generateToken(user.id, user.email, user.role, user.name);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        specialty: user.specialty,
        licenseNumber: user.licenseNumber,
        isApproved: user.isApproved,
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    // Si es médico, bloquear inicio de sesión si aún no está aprobado por el administrador
    if (user.role === 'MEDICO' && !user.isApproved) {
      throw new UnauthorizedException(
        'Cuenta pendiente de aprobación. Su Cédula Profesional está en proceso de verificación por el comité administrativo.'
      );
    }

    const token = this.generateToken(user.id, user.email, user.role, user.name);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        specialty: user.specialty,
        licenseNumber: user.licenseNumber,
        isApproved: user.isApproved,
      },
    };
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      return {
        valid: true,
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
        name: payload.name,
      };
    } catch {
      throw new UnauthorizedException('Token inválido o expirado.');
    }
  }

  async getDoctors() {
    return this.prisma.user.findMany({
      where: { role: 'MEDICO' },
      select: {
        id: true,
        name: true,
        email: true,
        specialty: true,
        licenseNumber: true,
        isApproved: true,
      },
    });
  }

  async approveDoctor(id: string, approve: boolean = true) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new ConflictException('Médico no encontrado.');
    }

    if (user.role !== 'MEDICO') {
      throw new ConflictException('El usuario especificado no es un médico.');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isApproved: approve },
    });

    return {
      success: true,
      message: approve ? 'Cuenta médica activada con éxito.' : 'Cuenta médica desactivada.',
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        licenseNumber: updated.licenseNumber,
        isApproved: updated.isApproved,
      },
    };
  }

  private generateToken(userId: string, email: string, role: string, name: string): string {
    const payload = { sub: userId, email, role, name };
    return this.jwtService.sign(payload);
  }
}
