import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

/**
 * DTO de entrada para HU-008 (CA-008-3): Agregar un ejercicio de la
 * biblioteca global a una sesion del plan.
 *
 * Solo recibe `exerciseId` — el service resuelve exerciseId -> ExerciseVersion
 * vigente (mayor versionNumber) en el momento de la llamada y persiste
 * SessionExercise.exerciseVersionId, nunca un puntero al ejercicio (RN-07).
 * `order` se calcula server-side, mismo criterio que AddPhaseDto/AddSessionDto
 * (D-5) — ninguna CA pide reordenar ejercicios dentro de una sesion.
 *
 * EXTENDIDO (D-15, EPICA-03 REABIERTA): gana 5 campos de prescripcion
 * OPCIONALES (sets, reps, loadKg, durationSeconds, distanceMeters) — el
 * entrenador puede agregar el ejercicio SIN ninguna prescripcion y
 * completarla despues via PATCH /plans/:id/sessions/:sessionId/exercises/:sessionExerciseId.
 * Sin validacion de "prescripcion significativa" aqui — esa regla solo se
 * evalua al publicar (D-15 punto 2/3), nunca al guardar.
 *
 * Validaciones de negocio resueltas en el service, no en este DTO:
 * - ENTITY_NOT_FOUND (404) si exerciseId no existe en la biblioteca global (RN-04)
 * - EXERCISE_INACTIVE (422) si el ejercicio existe pero esta inhabilitado
 *   (isActive=false) — mismo precedente que CA-006-6 de EPICA-02
 *
 * Rechazada por PlanPublishedGuard (409) si el plan no esta en Borrador.
 */
export class AddSessionExerciseDto {
  @ApiProperty({
    description:
      'UUID del ejercicio de la biblioteca global (Exercise) a agregar a la sesion. ' +
      'Debe existir (RN-04) y estar activo (isActive=true) — un ejercicio inhabilitado ' +
      'se rechaza con EXERCISE_INACTIVE (422) aunque exista.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'El id del ejercicio debe ser un UUID valido' })
  @IsString()
  @IsNotEmpty({ message: 'El id del ejercicio es obligatorio' })
  exerciseId: string;

  @ApiPropertyOptional({
    description:
      'Series prescritas (D-15). Opcional al guardar — el entrenador puede bosquejar ' +
      'la sesion sin volumenes en Borrador; se exige junto con reps solo al publicar, ' +
      'como parte del regimen de fuerza (D-15 punto 2a).',
    example: 4,
    minimum: 1,
  })
  @IsOptional()
  @IsInt({ message: 'sets debe ser un numero entero' })
  @Min(1, { message: 'sets debe ser al menos 1' })
  sets?: number;

  @ApiPropertyOptional({
    description:
      'Repeticiones prescritas por serie (D-15). Opcional al guardar — ver sets.',
    example: 10,
    minimum: 1,
  })
  @IsOptional()
  @IsInt({ message: 'reps debe ser un numero entero' })
  @Min(1, { message: 'reps debe ser al menos 1' })
  reps?: number;

  @ApiPropertyOptional({
    description:
      'Carga prescrita, en kilogramos (convencion, D-6). Opcional incluso dentro del ' +
      'regimen de fuerza — cubre ejercicios de peso corporal sin carga externa (D-15 ' +
      'punto 2a).',
    example: 80,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'loadKg debe ser un numero' })
  @Min(0, { message: 'loadKg no puede ser negativo' })
  loadKg?: number;

  @ApiPropertyOptional({
    description:
      'Duracion prescrita, en segundos (D-15). Regimen de resistencia — no se exige ' +
      'junto con distanceMeters al publicar (D-15 punto 2b, basta uno de los dos).',
    example: 1200,
    minimum: 1,
  })
  @IsOptional()
  @IsInt({ message: 'durationSeconds debe ser un numero entero' })
  @Min(1, { message: 'durationSeconds debe ser al menos 1' })
  durationSeconds?: number;

  @ApiPropertyOptional({
    description:
      'Distancia prescrita, en metros (convencion, D-6). Regimen de resistencia — no ' +
      'se exige junto con durationSeconds al publicar (D-15 punto 2b).',
    example: 5000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'distanceMeters debe ser un numero' })
  @Min(0, { message: 'distanceMeters no puede ser negativo' })
  distanceMeters?: number;
}
