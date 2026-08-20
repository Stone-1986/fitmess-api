import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller.js';
import { PlansCatalogController } from './plans-catalog.controller.js';
import { PlansService } from './plans.service.js';

/**
 * PlansModule — creacion, publicacion y ciclo de vida de planes de
 * entrenamiento, mas el catalogo publico de planes publicados (EPICA-03).
 *
 * No importa ningun otro modulo de dominio. Los guards que protegen sus
 * endpoints (JwtAuthGuard, RolesGuard, PlanPublishedGuard) los provee
 * CommonModule, que es `@Global` — ver el comentario de
 * `common/common.module.ts` para el porque. El perfil publico del
 * entrenador (D-2b) y la conexion con la biblioteca de ejercicios (D-2) se
 * resuelven leyendo Prisma directamente en PlansService, nunca importando
 * AuthModule ni ExercisesModule.
 */
@Module({
  controllers: [PlansController, PlansCatalogController],
  providers: [PlansService],
})
export class PlansModule {}
