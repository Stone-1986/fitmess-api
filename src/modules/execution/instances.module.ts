import { Module } from '@nestjs/common';
import { InstancesController } from './instances.controller.js';
import { InstancesService } from './instances.service.js';
import { SubscriptionActivatedListener } from './listeners/subscription-activated.listener.js';

/**
 * InstancesModule — ejecucion de la instancia personalizada del plan
 * (EPICA-05, modulo `execution`): creacion automatica (HU-023), registro
 * de resultados (HU-015), sensaciones semanales (HU-016) y cierre
 * automatico de semana (HU-017).
 *
 * No importa ningun otro modulo de dominio (D-2 de execution): lee
 * Plan/Subscription directamente via PrismaService (compartido, @Global) y
 * se comunica con `plans`/`subscriptions` UNICAMENTE via eventos
 * (@nestjs/event-emitter) — escucha subscription.activated (D-7 de
 * EPICA-04) y emite week.closed (D-4, sin listener todavia: ai/metrics son
 * epicas futuras). Los guards que protegen sus endpoints (JwtAuthGuard,
 * RolesGuard) los provee CommonModule, que es `@Global`.
 */
@Module({
  controllers: [InstancesController],
  providers: [InstancesService, SubscriptionActivatedListener],
})
export class InstancesModule {}
