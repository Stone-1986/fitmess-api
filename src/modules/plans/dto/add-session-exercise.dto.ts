import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

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
}
