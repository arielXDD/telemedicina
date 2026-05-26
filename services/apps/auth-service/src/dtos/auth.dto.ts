import { IsEmail, IsString, MinLength, IsIn, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  email!: string;

  @IsString({ message: 'La contraseña debe ser un texto.' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres.' })
  password!: string;

  @IsString({ message: 'El nombre es obligatorio.' })
  name!: string;

  @IsString()
  @IsIn(['PACIENTE', 'MEDICO'], { message: 'El rol debe ser PACIENTE o MEDICO.' })
  role!: 'PACIENTE' | 'MEDICO';

  @IsOptional()
  @IsString({ message: 'La especialidad debe ser un texto.' })
  specialty?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  email!: string;

  @IsString({ message: 'La contraseña es obligatoria.' })
  password!: string;
}
