import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InstanceSessionExerciseResponseDto } from './instance-session-exercise-response.dto.js';
import { SessionResultResponseDto } from './session-result-response.dto.js';

/**
 * DTO de una sesion embebida en el arbol completo de
 * GET /instances/:planId(/athletes/:athleteId) (D-2).
 *
 * `id` es el identificador que el cliente usa como `:sessionId` en
 * POST /instances/:planId/sessions/:sessionId/results (D-7: el atleta
 * conoce este id porque lo vio aqui, nunca lo adivina).
 *
 * `result` es null si el atleta aun no registro resultados de esta sesion
 * (D-2, D-6b upsert) — su presencia/ausencia es la señal que el cliente usa,
 * mismo criterio que `feeling` en InstanceWeekResponseDto.
 */
export class InstanceSessionResponseDto {
  @ApiProperty({
    description:
      'UUID de la sesion de la instancia (InstanceSession) — usado como :sessionId ' +
      'en POST .../sessions/:sessionId/results',
    example: 'c4d5e6f7-a8b9-4012-cdef-345678901234',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Nombre de la sesion, copiado de la plantilla',
    example: 'Dia 1 — Tren inferior (fuerza)',
  })
  name: string;

  @ApiProperty({
    description:
      'Posicion de esta sesion dentro de la semana, copiada de la plantilla',
    example: 1,
  })
  order: number;

  @ApiProperty({
    description:
      'Ejercicios de esta sesion, con su prescripcion copiada de la plantilla (CA-023-9)',
    type: [InstanceSessionExerciseResponseDto],
  })
  exercises: InstanceSessionExerciseResponseDto[];

  @ApiPropertyOptional({
    description:
      'Resultado registrado por el atleta para esta sesion. null si aun no lo registro ' +
      '(D-2, D-6b).',
    type: SessionResultResponseDto,
    nullable: true,
  })
  result: SessionResultResponseDto | null;
}
