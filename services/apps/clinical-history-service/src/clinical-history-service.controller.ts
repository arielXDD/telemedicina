import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ClinicalHistoryServiceService } from './clinical-history-service.service';
import { CreateRecordDto } from './dtos/record.dto';

@Controller('clinical-history')
export class ClinicalHistoryServiceController {
  constructor(private readonly clinicalHistoryService: ClinicalHistoryServiceService) {}

  @Post()
  async create(@Body() dto: CreateRecordDto) {
    return this.clinicalHistoryService.create(dto);
  }

  @Get('patient/:patientId')
  async findByPatient(@Param('patientId') patientId: string) {
    return this.clinicalHistoryService.findByPatient(patientId);
  }

  @Get('doctor/:doctorId')
  async findByDoctor(@Param('doctorId') doctorId: string) {
    return this.clinicalHistoryService.findByDoctor(doctorId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.clinicalHistoryService.findOne(id);
  }
}
