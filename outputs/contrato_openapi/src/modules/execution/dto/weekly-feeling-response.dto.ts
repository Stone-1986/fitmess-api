import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO de respuesta para las sensaciones semanales registradas por el atleta
 * (HU-016).
 *
 * Usado embebido en InstanceWeekResponseDto.feeling (null si el atleta aun
 * no las registro esa semana — D-2, CA-016-3: el cliente distingue por
 * presencia/ausencia del objeto, no por un flag booleano aparte) y como
 * respuesta directa de POST /instances/:planId/weeks/:weekId/feelings (200,
 * upsert — D-6b).
 *
 * DATO SENSIBLE DE SALUD (Ley 1581/2012, CA-016-6): `muscleSoreness` y
 * `motivation` solo pueden ser consultados por el atleta titular y por el
 * entrenador del plan correspondiente. Este DTO SOLO se serializa dentro de
 * GET /instances/:planId, GET /instances/:planId/athletes/:athleteId, y como
 * respuesta directa de este mismo POST — ningun otro endpoint de la epica lo
 * incluye (ni InstanceSummaryResponseDto ni ningun DTO de listado). NUNCA se
 * loggea ninguno de sus dos valores, ni siquiera en nivel debug.
 *
 * Escala RESUELTA (D-6, ya no placeholder): ambos campos son enteros de 1 a
 * 10, ambos inclusive (CA-016-9).
 */
export class WeeklyFeelingResponseDto {
  @ApiProperty({
    description: 'UUID del registro de sensaciones semanales (WeeklyFeeling)',
    example: 'f1a2b3c4-d5e6-4789-a012-b3c4d5e6f890',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description:
      'Nivel de dolor muscular percibido, escala entera de 1 (ninguno) a 10 (severo), ' +
      'ambos inclusive (RN-21, CA-016-9). Dato sensible de salud (Ley 1581/2012).',
    example: 4,
    minimum: 1,
    maximum: 10,
  })
  muscleSoreness: number;

  @ApiProperty({
    description:
      'Nivel de motivacion percibido, escala entera de 1 (muy baja) a 10 (muy alta), ' +
      'ambos inclusive (RN-21, CA-016-9). Dato sensible de salud (Ley 1581/2012).',
    example: 8,
    minimum: 1,
    maximum: 10,
  })
  motivation: number;

  @ApiProperty({
    description: 'Fecha del primer registro de sensaciones de esta semana',
    example: '2026-08-24T20:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha de la ultima edicion de este registro',
    example: '2026-08-24T20:00:00.000Z',
  })
  updatedAt: Date;
}
