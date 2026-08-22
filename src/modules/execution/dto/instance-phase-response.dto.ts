import { ApiProperty } from '@nestjs/swagger';
import { InstanceWeekResponseDto } from './instance-week-response.dto.js';

/**
 * DTO de una fase embebida en el arbol completo de
 * GET /instances/:planId(/athletes/:athleteId) (D-2).
 *
 * La cantidad de fases queda fijada segun la plantilla en el momento de la
 * copia (CA-023-3, RN-31) — ninguna operacion de esta epica agrega o quita
 * fases de la instancia.
 */
export class InstancePhaseResponseDto {
  @ApiProperty({
    description: 'UUID de la fase de la instancia (InstancePhase)',
    example: 'e6f7a8b9-c0d1-4234-efab-567890123456',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description:
      'Posicion de esta fase dentro de la instancia, copiada de la plantilla',
    example: 1,
  })
  order: number;

  @ApiProperty({
    description:
      'Semanas de esta fase, en el orden en que fueron copiadas de la plantilla',
    type: [InstanceWeekResponseDto],
  })
  weeks: InstanceWeekResponseDto[];
}
