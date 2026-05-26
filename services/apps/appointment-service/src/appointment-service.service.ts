import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateAppointmentDto, CreateScheduleDto } from './dtos/appointment.dto';
import Stripe from 'stripe';

@Injectable()
export class AppointmentServiceService {
  private stripe: any = null;

  constructor(private prisma: PrismaService) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey);
    }
  }

  async create(dto: CreateAppointmentDto) {
    const appointment = await this.prisma.appointment.create({
      data: {
        patientId: dto.patientId,
        patientName: dto.patientName,
        doctorId: dto.doctorId,
        doctorName: dto.doctorName,
        specialty: dto.specialty,
        dateTime: dto.dateTime,
        status: 'PENDIENTE',
        amount: dto.amount,
      },
    });

    let checkoutUrl = '';
    let sessionId = `mock_session_${appointment.id}`;

    // Si hay llave real de Stripe, creamos sesión real de Stripe Checkout
    if (this.stripe) {
      try {
        const session = await this.stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'mxn',
                product_data: {
                  name: `Consulta médica con el Dr. ${dto.doctorName} (${dto.specialty})`,
                },
                unit_amount: Math.round(dto.amount * 100), // Stripe requiere centavos
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `http://localhost:5173/payment-success?appointmentId=${appointment.id}`,
          cancel_url: `http://localhost:5173/payment-cancel?appointmentId=${appointment.id}`,
          metadata: {
            appointmentId: appointment.id,
          },
        });
        sessionId = session.id;
        checkoutUrl = session.url || '';
      } catch (error) {
        console.error('Error al crear sesión real de Stripe, cayendo en simulación:', error);
      }
    }

    // Si no hay Stripe o falló la creación, usamos la URL de simulación local
    if (!checkoutUrl) {
      checkoutUrl = `http://localhost:5173/checkout-simulation?appointmentId=${appointment.id}&amount=${dto.amount}&doctorName=${encodeURIComponent(dto.doctorName)}&specialty=${encodeURIComponent(dto.specialty)}`;
    }

    // Actualizamos el ID de sesión
    await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: { stripeSessionId: sessionId },
    });

    return {
      appointment,
      checkoutUrl,
      sessionId,
    };
  }

  async confirmPayment(id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada.');
    }

    return this.prisma.appointment.update({
      where: { id },
      data: { status: 'PAGADA' },
    });
  }

  async updateStatus(id: string, status: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada.');
    }

    return this.prisma.appointment.update({
      where: { id },
      data: { status },
    });
  }

  async findByPatient(patientId: string) {
    return this.prisma.appointment.findMany({
      where: { patientId },
      orderBy: { dateTime: 'asc' },
    });
  }

  async findByDoctor(doctorId: string) {
    return this.prisma.appointment.findMany({
      where: { doctorId },
      orderBy: { dateTime: 'asc' },
    });
  }

  async findAll() {
    return this.prisma.appointment.findMany({
      orderBy: { dateTime: 'asc' },
    });
  }

  async createSchedule(dto: CreateScheduleDto) {
    return this.prisma.doctorSchedule.create({
      data: dto,
    });
  }

  async getDoctorSchedule(doctorId: string) {
    return this.prisma.doctorSchedule.findMany({
      where: { doctorId },
    });
  }
}
