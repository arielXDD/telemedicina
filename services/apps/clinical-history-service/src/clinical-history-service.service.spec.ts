import { ClinicalHistoryServiceService } from './clinical-history-service.service';

describe('ClinicalHistoryServiceService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
    medicalRecord: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.medicalRecord.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'record-1',
        ...data,
        createdAt: new Date('2026-05-30T00:00:00.000Z'),
      }),
    );
  });

  it('guarda datos sensibles cifrados y retorna el expediente descifrado', async () => {
    const service = new ClinicalHistoryServiceService(prisma as any);

    const result = await service.create({
      patientId: 'patient-1',
      patientName: 'Paciente Demo',
      doctorId: 'doctor-1',
      doctorName: 'Medico Demo',
      diagnosis: 'Hipertension controlada',
      treatment: 'Monitoreo semanal y ajuste de dieta',
      date: '2026-05-30T00:00:00.000Z',
    });

    const createCall = prisma.medicalRecord.create.mock.calls[0][0];
    expect(createCall.data.encryptedDiagnosis).not.toContain('Hipertension controlada');
    expect(createCall.data.encryptedTreatment).not.toContain('Monitoreo semanal');
    expect(result).toMatchObject({
      id: 'record-1',
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      diagnosis: 'Hipertension controlada',
      treatment: 'Monitoreo semanal y ajuste de dieta',
    });
  });
});
