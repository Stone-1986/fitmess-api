import { ApiProperty } from '@nestjs/swagger';
import { PlanCatalogWeekResponseDto } from './plan-catalog-week-response.dto.js';

/**
 * DTO de una fase dentro del detalle del catalogo (HU-011, CA-011-2):
 * GET /catalog/plans/:id.
 */
export class PlanCatalogPhaseResponseDto {
  @ApiProperty({
    description: 'UUID de la fase',
    example: 'e5f6a7b8-c9d0-1234-efab-345678901234',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Nombre de la fase',
    example: 'Fase 1 — Adaptacion anatomica',
  })
  name: string;

  @ApiProperty({
    description: 'Semanas de esta fase, en el orden en que fueron agregadas',
    type: [PlanCatalogWeekResponseDto],
  })
  weeks: PlanCatalogWeekResponseDto[];
}
