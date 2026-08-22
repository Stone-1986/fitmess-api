import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { InstancesService } from '../instances.service.js';

/**
 * Evento emitido por SubscriptionsService.acceptConsent() (EPICA-04,
 * HU-014). Solo IDs.
 */
export interface SubscriptionActivatedEvent {
  subscriptionId: string;
  athleteId: string;
  planId: string;
}

/**
 * SubscriptionActivatedListener — listener del evento
 * subscription.activated (EPICA-05, HU-023). Camino RAPIDO de la creacion
 * de la instancia personalizada (D-3): dispara getOrCreateInstance()
 * inmediatamente al activarse la suscripcion. Es el punto de enganche que
 * EPICA-04 dejo deliberadamente sin proceso que lo escuche (decision D-7
 * de su plan de implementacion).
 *
 * Si falla (error transitorio, ventana de carrera, etc.), el atleta queda
 * Activo sin instancia hasta que el o su entrenador consulten
 * GET /instances/:planId(/athletes/:athleteId) — el camino de
 * AUTO-REPARACION (D-3) crea la instancia sobre la marcha en ese momento.
 * No hay reintento automatico en segundo plano (riesgo aceptado a escala
 * MVP, ver el plan de implementacion de EPICA-05).
 */
@Injectable()
export class SubscriptionActivatedListener {
  constructor(
    private readonly instancesService: InstancesService,
    @InjectPinoLogger(SubscriptionActivatedListener.name)
    private readonly logger: PinoLogger,
  ) {}

  @OnEvent('subscription.activated')
  async handleSubscriptionActivated(
    event: SubscriptionActivatedEvent,
  ): Promise<void> {
    try {
      await this.instancesService.getOrCreateInstance(
        event.athleteId,
        event.planId,
        event.subscriptionId,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      // Log solo IDs — nunca datos personales (Ley 1273/2009)
      this.logger.error(
        { subscriptionId: event.subscriptionId, errorMessage: message },
        'Error en listener subscription.activated — la instancia no fue creada; ' +
          'se autorreparara en el proximo GET /instances/:planId (D-3)',
      );
      // No relanzar — los listeners no propagan excepciones al pipeline HTTP
    }
  }
}
