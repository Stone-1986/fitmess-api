import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

/**
 * DTO de entrada NUEVO (D-15, EPICA-03 REABIERTA) para
 * PATCH /plans/:id/sessions/:sessionId/exercises/:sessionExerciseId.
 *
 * Edita la prescripcion de un ejercicio de sesion YA AGREGADO — primer
 * endpoint de edicion de SessionExercise del proyecto (hasta esta epica,
 * EPICA-03 solo exponia add/remove, nunca update).
 *
 * Los 5 campos son TODOS opcionales — actualizacion PARCIAL: el entrenador
 * puede completar solo el campo que le falta (ej. agregar loadKg a un
 * ejercicio que ya tenia sets/reps) sin tener que reenviar los demas. Un
 * campo omitido NO se sobreescribe a null — mismo criterio ya establecido
 * por UpdatePlanDto/UpdateExerciseDto para actualizaciones parciales del
 * proyecto.
 *
 * Sin validacion de "prescripcion significativa" aqui — esa regla solo se
 * evalua al publicar el plan (D-15 punto 2/3), nunca al editar.
 *
 * Rechazado por PlanPublishedGuard (409) si el plan no esta en Borrador
 * (RN-31) — mismos guards que sus vecinos de estructura en PlansController.
 */
export class UpdateSessionExercisePrescriptionDto {
  @ApiPropertyOptional({
    description: 'Series prescritas (D-15). Omitido = sin cambios.',
    example: 4,
    minimum: 1,
  })
  @IsOptional()
  @IsInt({ message: 'sets debe ser un numero entero' })
  @Min(1, { message: 'sets debe ser al menos 1' })
  sets?: number;

  @ApiPropertyOptional({
    description:
      'Repeticiones prescritas por serie (D-15). Omitido = sin cambios.',
    example: 10,
    minimum: 1,
  })
  @IsOptional()
  @IsInt({ message: 'reps debe ser un numero entero' })
  @Min(1, { message: 'reps debe ser al menos 1' })
  reps?: number;

  @ApiPropertyOptional({
    description:
      'Carga prescrita, en kilogramos (convencion, D-6). Omitido = sin cambios.',
    example: 80,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'loadKg debe ser un numero' })
  @Min(0, { message: 'loadKg no puede ser negativo' })
  loadKg?: number;

  @ApiPropertyOptional({
    description:
      'Duracion prescrita, en segundos (D-15). Omitido = sin cambios.',
    example: 1200,
    minimum: 1,
  })
  @IsOptional()
  @IsInt({ message: 'durationSeconds debe ser un numero entero' })
  @Min(1, { message: 'durationSeconds debe ser al menos 1' })
  durationSeconds?: number;

  @ApiPropertyOptional({
    description:
      'Distancia prescrita, en metros (convencion, D-6). Omitido = sin cambios.',
    example: 5000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'distanceMeters debe ser un numero' })
  @Min(0, { message: 'distanceMeters no puede ser negativo' })
  distanceMeters?: number;
}
