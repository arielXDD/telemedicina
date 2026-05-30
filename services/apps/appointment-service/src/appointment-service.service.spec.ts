import { AppointmentServiceService } from './appointment-service.service';

describe('AppointmentServiceService', () => {
  const appointment = {
    id: 'appt-1',
    patientId: 'patient-1',
    patientName: 'Paciente Demo',
    doctorId: 'doctor-1',
    doctorName: 'Medico Demo',
    specialty: 'Cardiologia',
    dateTime: '2026-06-01T10:00:00.000Z',
    status: 'PENDIENTE',
    amount: 750,
    stripeSessionId: null,
    createdAt: new Date('2026-05-30T00:00:00.000Z'),
  };

  const prisma = {
    $queryRaw: jest.fn(),
    appointment: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    doctorSchedule: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.STRIPE_SECRET_KEY;
    process.env.FRONTEND_URL = 'http://frontend.test';
    prisma.appointment.create.mockResolvedValue(appointment);
    prisma.appointment.update.mockResolvedValue({
      ...appointment,
      stripeSessionId: `mock_session_${appointment.id}`,
    });
  });

  it('crea una cita y devuelve checkout simulado cuando Stripe no esta configurado', async () => {
    const service = new AppointmentServiceService(prisma as any);

    const result = await service.create({
      patientId: appointment.patientId,
      patientName: appointment.patientName,
      doctorId: appointment.doctorId,
      doctorName: appointment.doctorName,
      specialty: appointment.specialty,
      dateTime: appointment.dateTime,
      amount: appointment.amount,
    });

    expect(prisma.appointment.create).toHaveBeenCalledWith({
      data: {
        patientId: appointment.patientId,
        patientName: appointment.patientName,
        doctorId: appointment.doctorId,
        doctorName: appointment.doctorName,
        specialty: appointment.specialty,
        dateTime: appointment.dateTime,
        status: 'PENDIENTE',
        amount: appointment.amount,
      },
    });
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: appointment.id },
      data: { stripeSessionId: `mock_session_${appointment.id}` },
    });
    expect(result.checkoutUrl).toContain('http://frontend.test/checkout-simulation');
    expect(result.sessionId).toBe(`mock_session_${appointment.id}`);
  });
});
