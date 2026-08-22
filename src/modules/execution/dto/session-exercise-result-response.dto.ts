import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO de respuesta para el resultado de UN ejercicio dentro de una sesion
 * registrada (HU-015, hijo tipado de SessionResult — D-6).
 *
 * Usado embebido en SessionResultResponseDto.exerciseResults (a su vez
 * embebido en InstanceSessionResponseDto.result, dentro de
 * GET /instances/:planId(/athletes/:athleteId)) y en la respuesta directa de
 * POST /instances/:planId/sessions/:sessionId/results.
 *
 * `sessionExerciseId` correlaciona esta fila con el
 * InstanceSessionExerciseResponseDto correspondiente dentro de
 * InstanceSessionResponseDto.exercises — el mismo id que el cliente ya vio
 * en el arbol y que envio en el payload de registro.
 *
 * Los 5 campos (sets, reps, loadKg, durationSeconds, distanceMeters) son
 * nullable porque el atleta solo llena los que aplican al tipo de ejercicio
 * (CA-015-11: fuerza -> series/reps/carga; resistencia -> duracion/distancia) —
 * MISMOS campos que la prescripcion de la plantilla (D-6), comparables uno a
 * uno. `notes` es la unica diferencia respecto a la prescripcion: solo el
 * resultado la tiene.
 *
 * No es dato sensible de salud (Ley 1581/2012) — confirmado por el Analista
 * de Producto en HU-015 (CA-015-9): ninguno de estos 5 campos ni la nota
 * libre caen bajo ese regimen, a diferencia de WeeklyFeelingResponseDto.
 *
 * NUNCA expone: `instanceSessionExerciseId` como nombre de columna interno
 * (se expone como `sessionExerciseId`, el mismo vocabulario que usa el
 * cliente), ni ningun campo de auditoria.
 */
export class SessionExerciseResultResponseDto {
  @ApiProperty({
    description: 'UUID de este resultado de ejercicio (SessionExerciseResult)',
    example: 'e1a2b3c4-d5e6-4789-a012-b3c4d5e6f789',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description:
      'UUID del ejercicio de sesion de la instancia (InstanceSessionExercise) al que ' +
      'corresponde este resultado — el mismo id listado en ' +
      'InstanceSessionResponseDto.exercises[].id.',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    format: 'uuid',
  })
  sessionExerciseId: string;

  @ApiPropertyOptional({
    description:
      'Series realizadas. Solo presente si el atleta la reporto — tipico de ejercicios ' +
      'de fuerza (CA-015-11).',
    example: 4,
    type: Number,
    nullable: true,
  })
  sets: number | null;

  @ApiPropertyOptional({
    description:
      'Repeticiones realizadas por serie. Tipico de ejercicios de fuerza.',
    example: 10,
    type: Number,
    nullable: true,
  })
  reps: number | null;

  @ApiPropertyOptional({
    description:
      'Carga utilizada, en kilogramos (convencion, D-6 — sin unidad confirmada por CA).',
    example: 80,
    type: Number,
    nullable: true,
  })
  loadKg: number | null;

  @ApiPropertyOptional({
    description:
      'Duracion realizada, en segundos. Tipico de ejercicios de resistencia (CA-015-11).',
    example: 1200,
    type: Number,
    nullable: true,
  })
  durationSeconds: number | null;

  @ApiPropertyOptional({
    description:
      'Distancia recorrida, en metros (convencion, D-6). Tipico de ejercicios de resistencia.',
    example: 5000,
    type: Number,
    nullable: true,
  })
  distanceMeters: number | null;

  @ApiPropertyOptional({
    description: 'Nota libre opcional del atleta sobre este ejercicio',
    example: 'Sentí molestia leve en la rodilla derecha en la última serie',
    type: String,
    nullable: true,
  })
  notes: string | null;
}
