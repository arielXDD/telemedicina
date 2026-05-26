import { IsString, IsOptional } from 'class-validator';

export class CreateRecordDto {
  @IsString({ message: 'El ID del paciente es obligatorio.' })
  patientId!: string;

  @IsString({ message: 'El nombre del paciente es obligatorio.' })
  patientName!: string;

  @IsString({ message: 'El ID del médico es obligatorio.' })
  doctorId!: string;

  @IsString({ message: 'El nombre del médico es obligatorio.' })
  doctorName!: string;

  @IsString({ message: 'El diagnóstico es obligatorio.' })
  diagnosis!: string;

  @IsString({ message: 'Las indicaciones de tratamiento son obligatorias.' })
  treatment!: string;

  @IsOptional()
  @IsString()
  date?: string;
}
