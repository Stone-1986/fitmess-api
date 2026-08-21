import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EmailService } from '../email.service.js';

/**
 * Evento emitido por SubscriptionsService.create() (EPICA-04, HU-012). Solo
 * IDs — el listener resuelve email/nombre via PrismaService (compartido,
 * @Global), nunca via import de otro service de dominio.
 */
export interface SubscriptionRequestedEvent {
  subscriptionId: string;
  athleteId: string;
  planId: string;
  coachId: string;
}

/**
 * SubscriptionRequestedListener — listener del evento subscription.requested.
 *
 * Responsabilidad: notificar al entrenador dueño del plan que recibio una
 * nueva solicitud de inscripcion (CA-012-1). Los errores de envio se
 * capturan en try/catch sin propagar al pipeline HTTP. El log SOLO registra
 * el subscriptionId — nunca el nombre del atleta ni el correo del
 * entrenador (Ley 1273/2009), mismo criterio que AdminInvitationCreatedListener.
 */
@Injectable()
export class SubscriptionRequestedListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    @InjectPinoLogger(SubscriptionRequestedListener.name)
    private readonly logger: PinoLogger,
  ) {}

  @OnEvent('subscription.requested')
  async handleSubscriptionRequested(
    event: SubscriptionRequestedEvent,
  ): Promise<void> {
    try {
      const [coach, athlete, plan] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: event.coachId },
          select: { email: true },
        }),
        this.prisma.user.findUnique({
          where: { id: event.athleteId },
          select: { name: true },
        }),
        this.prisma.plan.findUnique({
          where: { id: event.planId },
          select: { name: true },
        }),
      ]);

      if (!coach || !athlete || !plan) {
        this.logger.warn(
          { subscriptionId: event.subscriptionId },
          'Evento subscription.requested con datos incompletos — el correo no fue enviado',
        );
        return;
      }

      await this.emailService.sendSubscriptionRequested(
        coach.email,
        athlete.name,
        plan.name,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      // Log solo el ID de la suscripcion — nunca el nombre del atleta ni el
      // correo del entrenador (Ley 1273/2009)
      this.logger.error(
        { subscriptionId: event.subscriptionId, errorMessage: message },
        'Error en listener subscription.requested — el correo no fue enviado',
      );
      // No relanzar — los listeners no propagan excepciones al pipeline HTTP
    }
  }
}
