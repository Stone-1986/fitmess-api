import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller.js';
import { SubscriptionsService } from './subscriptions.service.js';

/**
 * SubscriptionsModule — inscripcion de atletas a planes de entrenamiento
 * (EPICA-04): solicitud, aprobacion/rechazo y consentimiento informado
 * deportivo.
 *
 * No importa ningun otro modulo de dominio (D-2): lee Plan/User
 * directamente via PrismaService (compartido, @Global) y se comunica con
 * `notifications` unicamente via eventos (@nestjs/event-emitter). Los
 * guards que protegen sus endpoints (JwtAuthGuard, RolesGuard) los provee
 * CommonModule, que es `@Global`.
 */
@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
})
export class SubscriptionsModule {}
