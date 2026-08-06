import { Module } from '@nestjs/common';
import { ExercisesController } from './exercises.controller.js';
import { ExercisesService } from './exercises.service.js';

/**
 * ExercisesModule — biblioteca global de ejercicios (EPICA-02).
 *
 * No importa ningun otro modulo de dominio. Los guards que protegen sus
 * endpoints (JwtAuthGuard, RolesGuard) los provee CommonModule, que es
 * `@Global` — ver el comentario de `common/common.module.ts` para el porque.
 */
@Module({
  controllers: [ExercisesController],
  providers: [ExercisesService],
})
export class ExercisesModule {}
