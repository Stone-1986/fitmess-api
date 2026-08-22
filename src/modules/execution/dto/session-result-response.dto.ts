import { ApiProperty } from '@nestjs/swagger';
import { SessionExerciseResultResponseDto } from './session-exercise-result-response.dto.js';

/**
 * DTO de respuesta para el resultado agregado de UNA sesion de la instancia
 * (HU-015 — D-6: registro padre, casi vacio de datos propios).
 *
 * Usado embebido en InstanceSessionResponseDto.result (null si el atleta aun
 * no registro resultados de esa sesion — D-2) y como respuesta directa de
 * POST /instances/:planId/sessions/:sessionId/results (200, upsert — D-6b).
 *
 * `exerciseResults` trae, por construccion (paso 3 del flujo de registro,
 * RESULT_FIELDS_INVALID), EXACTAMENTE un item por cada ejercicio programado
 * de la sesion — nunca de mas ni de menos (CA-015-10). Por eso una fila
 * SessionResult nunca existe en estado parcial (D-4).
 *
 * NUNCA expone: `instanceSessionId` (redundante — el cliente ya lo conoce
 * por el contexto en el que pidio o recibio este DTO), `athleteId`
 * (denormalizado internamente, redundante para el propio atleta y ya
 * conocido por el entrenador via `:athleteId` de la ruta).
 */
export class SessionResultResponseDto {
  @ApiProperty({
    description: 'UUID del resultado de sesion (SessionResult)',
    example: 'd0e1f2a3-b4c5-4678-9012-a3b4c5d6e789',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description:
      'Resultados por ejercicio de esta sesion — uno por cada ejercicio programado, ' +
      'sin excepcion (CA-015-10).',
    type: [SessionExerciseResultResponseDto],
  })
  exerciseResults: SessionExerciseResultResponseDto[];

  @ApiProperty({
    description: 'Fecha del primer registro de resultados de esta sesion',
    example: '2026-08-24T18:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description:
      'Fecha de la ultima edicion de este resultado — se actualiza aunque el cambio ' +
      'este en un SessionExerciseResult hijo (D-6, sin updatedAt propio en el hijo)',
    example: '2026-08-24T18:30:00.000Z',
  })
  updatedAt: Date;
}
