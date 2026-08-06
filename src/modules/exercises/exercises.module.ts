import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ExercisesController } from './exercises.controller.js';
import { ExercisesService } from './exercises.service.js';

/**
 * ExercisesModule — biblioteca global de ejercicios (EPICA-02).
 *
 * Importa AuthModule para reutilizar JwtAuthGuard y RolesGuard (exportados
 * explicitamente por AuthModule para este proposito — no es un import de
 * logica de negocio de otro modulo, es infraestructura de autenticacion
 * compartida, igual que prisma/common).
 */
@Module({
  imports: [AuthModule],
  controllers: [ExercisesController],
  providers: [ExercisesService],
})
export class ExercisesModule {}
