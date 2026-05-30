import { Controller, Post, Body, Put, Param, Get, Query } from '@nestjs/common';
import { AppointmentServiceService } from './appointment-service.service';
import { CreateAppointmentDto, UpdateAppointmentStatusDto, CreateScheduleDto } from './dtos/appointment.dto';

@Controller('appointments')
export class AppointmentServiceController {
  constructor(private readonly appointmentService: AppointmentServiceService) {}

  @Get('health')
  async health() {
    return this.appointmentService.health();
  }

  @Post()
  async create(@Body() dto: CreateAppointmentDto) {
    return this.appointmentService.create(dto);
  }

  @Post('confirm-payment/:id')
  async confirmPayment(@Param('id') id: string) {
    return this.appointmentService.confirmPayment(id);
  }

  @Put('status/:id')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateAppointmentStatusDto) {
    return this.appointmentService.updateStatus(id, dto.status);
  }

  @Get('patient/:patientId')
  async findByPatient(@Param('patientId') patientId: string) {
    return this.appointmentService.findByPatient(patientId);
  }

  @Get('doctor/:doctorId')
  async findByDoctor(@Param('doctorId') doctorId: string) {
    return this.appointmentService.findByDoctor(doctorId);
  }

  @Get()
  async findAll() {
    return this.appointmentService.findAll();
  }

  @Post('schedule')
  async createSchedule(@Body() dto: CreateScheduleDto) {
    return this.appointmentService.createSchedule(dto);
  }

  @Get('schedule/:doctorId')
  async getDoctorSchedule(@Param('doctorId') doctorId: string) {
    return this.appointmentService.getDoctorSchedule(doctorId);
  }
}
