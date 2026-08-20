import { ApiProperty } from '@nestjs/swagger';
import { PlanCatalogSessionResponseDto } from './plan-catalog-session-response.dto.js';

/**
 * DTO de una semana dentro del detalle del catalogo (HU-011, CA-011-2):
 * GET /catalog/plans/:id.
 */
export class PlanCatalogWeekResponseDto {
  @ApiProperty({
    description: 'UUID de la semana',
    example: 'd4e5f6a7-b8c9-0123-defa-234567890123',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description:
      'Numero de la semana, secuencial a lo largo de TODO el plan (no reinicia por fase, D-4)',
    example: 1,
  })
  weekNumber: number;

  @ApiProperty({
    description: 'Sesiones de esta semana, en el orden en que fueron agregadas',
    type: [PlanCatalogSessionResponseDto],
  })
  sessions: PlanCatalogSessionResponseDto[];
}
