import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateRecordDto } from './dtos/record.dto';
import { encrypt, decrypt } from '../../shared/crypto';

@Injectable()
export class ClinicalHistoryServiceService {
  constructor(private prisma: PrismaService) {}

  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'OK', service: 'clinical-history-service', database: 'reachable' };
  }

  async create(dto: CreateRecordDto) {
    // Generar encriptación independiente para diagnóstico e indicaciones (IVs independientes)
    const diagEnc = encrypt(dto.diagnosis);
    const treatEnc = encrypt(dto.treatment);

    // Guardamos la información encriptada con sus IVs concatenados (practica recomendada de IV autocontenido)
    let record;
    try {
      record = await this.prisma.medicalRecord.create({
        data: {
          patientId: dto.patientId,
          patientName: dto.patientName,
          doctorId: dto.doctorId,
          doctorName: dto.doctorName,
          date: dto.date || new Date().toISOString(),
          encryptedDiagnosis: `${diagEnc.iv}:${diagEnc.encryptedData}`,
          encryptedTreatment: `${treatEnc.iv}:${treatEnc.encryptedData}`,
          iv: diagEnc.iv, // Guardamos el IV principal como referencia
        },
      });
    } catch (e) {
      console.error('Error creating medical record:', e);
      throw e;
    }

    return this.decryptRecord(record);
  }

  async findByPatient(patientId: string) {
    const records = await this.prisma.medicalRecord.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });

    return records.map(r => this.decryptRecord(r));
  }

  async findByDoctor(doctorId: string) {
    const records = await this.prisma.medicalRecord.findMany({
      where: { doctorId },
      orderBy: { createdAt: 'desc' },
    });

    return records.map(r => this.decryptRecord(r));
  }

  async findOne(id: string) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException('Expediente clínico no encontrado.');
    }

    return this.decryptRecord(record);
  }

  // Método auxiliar para desencriptar un registro de forma segura antes de retornarlo
  private decryptRecord(record: any) {
    let decryptedDiagnosis = '[Error al descifrar diagnóstico]';
    let decryptedTreatment = '[Error al descifrar indicaciones]';

    // Desencriptar diagnóstico
    if (record.encryptedDiagnosis && record.encryptedDiagnosis.includes(':')) {
      const [iv, data] = record.encryptedDiagnosis.split(':');
      decryptedDiagnosis = decrypt(data, iv);
    } else if (record.encryptedDiagnosis) {
      // Fallback si no tiene IV concatenado (usa el IV de la columna de la base de datos)
      decryptedDiagnosis = decrypt(record.encryptedDiagnosis, record.iv);
    }

    // Desencriptar tratamiento
    if (record.encryptedTreatment && record.encryptedTreatment.includes(':')) {
      const [iv, data] = record.encryptedTreatment.split(':');
      decryptedTreatment = decrypt(data, iv);
    } else if (record.encryptedTreatment) {
      // Fallback
      decryptedTreatment = decrypt(record.encryptedTreatment, record.iv);
    }

    return {
      id: record.id,
      patientId: record.patientId,
      patientName: record.patientName,
      doctorId: record.doctorId,
      doctorName: record.doctorName,
      date: record.date,
      diagnosis: decryptedDiagnosis,
      treatment: decryptedTreatment,
      createdAt: record.createdAt,
    };
  }
}
