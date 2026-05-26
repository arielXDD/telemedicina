import { IsString, IsNumber, IsISO8601, IsIn, IsOptional } from 'class-validator';

export class CreateAppointmentDto {
  @IsString({ message: 'El ID del paciente es obligatorio.' })
  patientId!: string;

  @IsString({ message: 'El nombre del paciente es obligatorio.' })
  patientName!: string;

  @IsString({ message: 'El ID del médico es obligatorio.' })
  doctorId!: string;

  @IsString({ message: 'El nombre del médico es obligatorio.' })
  doctorName!: string;

  @IsString({ message: 'La especialidad es obligatoria.' })
  specialty!: string;

  @IsISO8601({}, { message: 'La fecha y hora debe tener un formato ISO válido.' })
  dateTime!: string;

  @IsNumber({}, { message: 'El monto debe ser un número.' })
  amount!: number;
}

export class UpdateAppointmentStatusDto {
  @IsString()
  @IsIn(['PENDIENTE', 'PAGADA', 'COMPLETADA', 'CANCELADA'], {
    message: 'El estado debe ser PENDIENTE, PAGADA, COMPLETADA o CANCELADA.',
  })
  status!: string;
}

export class CreateScheduleDto {
  @IsString()
  doctorId!: string;

  @IsString()
  @IsIn(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'])
  dayOfWeek!: string;

  @IsString()
  startTime!: string; // ej: "09:00"

  @IsString()
  endTime!: string; // ej: "17:00"
}
