import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EmailService } from '../email.service.js';

/**
 * Evento emitido por SubscriptionsService.approve() (EPICA-04, HU-013). Solo
 * IDs — el listener resuelve email/nombre via PrismaService (compartido,
 * @Global), nunca via import de otro service de dominio.
 */
export interface SubscriptionApprovedEvent {
  subscriptionId: string;
  athleteId: string;
  planId: string;
  coachId: string;
}

/**
 * SubscriptionApprovedListener — listener del evento subscription.approved.
 *
 * Responsabilidad: notificar al atleta que su solicitud fue aprobada, Y que
 * debe aceptar el consentimiento informado del plan para poder iniciar sus
 * sesiones (CA-013-1, texto explicito exigido por la HU). Los errores de
 * envio se capturan en try/catch sin propagar al pipeline HTTP. El log SOLO
 * registra el subscriptionId — nunca el correo del atleta (Ley 1273/2009).
 */
@Injectable()
export class SubscriptionApprovedListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    @InjectPinoLogger(SubscriptionApprovedListener.name)
    private readonly logger: PinoLogger,
  ) {}

  @OnEvent('subscription.approved')
  async handleSubscriptionApproved(
    event: SubscriptionApprovedEvent,
  ): Promise<void> {
    try {
      const [athlete, plan] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: event.athleteId },
          select: { email: true },
        }),
        this.prisma.plan.findUnique({
          where: { id: event.planId },
          select: { name: true },
        }),
      ]);

      if (!athlete || !plan) {
        this.logger.warn(
          { subscriptionId: event.subscriptionId },
          'Evento subscription.approved con datos incompletos — el correo no fue enviado',
        );
        return;
      }

      await this.emailService.sendSubscriptionApproved(
        athlete.email,
        plan.name,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      // Log solo el ID de la suscripcion — nunca el correo del atleta (Ley 1273/2009)
      this.logger.error(
        { subscriptionId: event.subscriptionId, errorMessage: message },
        'Error en listener subscription.approved — el correo no fue enviado',
      );
      // No relanzar — los listeners no propagan excepciones al pipeline HTTP
    }
  }
}
