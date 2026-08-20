import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CoachSummaryResponseDto } from './coach-summary-response.dto.js';

/**
 * DTO de un elemento del listado del catalogo (HU-011, CA-011-1):
 * GET /catalog/plans (200).
 *
 * Solo incluye lo que CA-011-1 pide literalmente: nombre del plan, sus
 * fechas y el perfil publico REDUCIDO del entrenador (id, name, avatarUrl —
 * ver CoachSummaryResponseDto). NO incluye description del plan ni el
 * perfil completo del entrenador — eso es exclusivo del detalle
 * (GET /catalog/plans/:id, ver PlanCatalogDetailResponseDto).
 */
export class PlanCatalogSummaryResponseDto {
  @ApiProperty({
    description: 'UUID del plan',
    example: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Nombre del plan',
    example: 'Fuerza e hipertrofia — bloque 1',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Fecha de inicio del plan',
    example: '2026-09-01',
    format: 'date',
    type: String,
    nullable: true,
  })
  startDate: string | null;

  @ApiPropertyOptional({
    description: 'Fecha de fin del plan',
    example: '2026-10-27',
    format: 'date',
    type: String,
    nullable: true,
  })
  endDate: string | null;

  @ApiProperty({
    description: 'Perfil publico reducido del entrenador que publico el plan',
    type: CoachSummaryResponseDto,
  })
  coach: CoachSummaryResponseDto;
}
