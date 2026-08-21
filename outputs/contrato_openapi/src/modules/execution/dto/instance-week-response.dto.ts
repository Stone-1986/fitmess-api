import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InstanceSessionResponseDto } from './instance-session-response.dto.js';
import { WeeklyFeelingResponseDto } from './weekly-feeling-response.dto.js';

/**
 * DTO de una semana embebida en el arbol completo de
 * GET /instances/:planId(/athletes/:athleteId) (D-2).
 *
 * `id` es el identificador que el cliente usa como `:weekId` en
 * POST /instances/:planId/weeks/:weekId/feelings (D-7).
 *
 * `isClosed`/`closedAt` viajan aqui (D-2, D-5 — Frozen Flag directamente en
 * InstanceWeek, sin tabla WeekClosure separada). Una vez `isClosed=true`
 * (RN-09, RN-30), cualquier intento de editar un resultado de sesion o las
 * sensaciones de esta semana se rechaza con WEEK_FROZEN (409).
 *
 * `feeling` es null si el atleta aun no registro sus sensaciones de esta
 * semana (CA-016-3: el cliente distingue por presencia/ausencia del objeto).
 * DATO SENSIBLE DE SALUD cuando presente (Ley 1581/2012, CA-016-6) — ver
 * WeeklyFeelingResponseDto.
 */
export class InstanceWeekResponseDto {
  @ApiProperty({
    description:
      'UUID de la semana de la instancia (InstanceWeek) — usado como :weekId ' +
      'en POST .../weeks/:weekId/feelings',
    example: 'd5e6f7a8-b9c0-4123-defa-456789012345',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description:
      'Numero de la semana, secuencial a lo largo de TODA la instancia (no reinicia ' +
      'por fase — mismo criterio D-4 de EPICA-03 aplicado a InstanceWeek, D-1)',
    example: 1,
  })
  weekNumber: number;

  @ApiProperty({
    description:
      'true si la semana cerro automaticamente por completitud de todas sus sesiones ' +
      '(RN-09, RN-30, CA-017-1). Una semana cerrada congela sus resultados y sensaciones ' +
      '— cualquier intento de editarlos responde WEEK_FROZEN (409, CA-015-4/CA-016-2).',
    example: false,
  })
  isClosed: boolean;

  @ApiPropertyOptional({
    description:
      'Momento exacto en que la semana cerro. Solo presente cuando isClosed=true.',
    example: '2026-09-05T22:10:00.000Z',
    type: String,
    nullable: true,
  })
  closedAt: Date | null;

  @ApiProperty({
    description: 'Sesiones de esta semana, en el orden en que fueron copiadas de la plantilla',
    type: [InstanceSessionResponseDto],
  })
  sessions: InstanceSessionResponseDto[];

  @ApiPropertyOptional({
    description:
      'Sensaciones semanales registradas por el atleta. null si aun no las registro ' +
      '(CA-016-3). Dato sensible de salud (Ley 1581/2012, CA-016-6) — solo visible para ' +
      'el atleta titular y el entrenador del plan.',
    type: WeeklyFeelingResponseDto,
    nullable: true,
  })
  feeling: WeeklyFeelingResponseDto | null;
}
