import { ApiProperty } from '@nestjs/swagger';
import { WeekDetailResponseDto } from './week-detail-response.dto.js';

/**
 * DTO de una fase embebida en el arbol completo de GET /plans/:id (D-8).
 *
 * A diferencia de PhaseResponseDto (respuesta de la creacion incremental),
 * este SI incluye `weeks`.
 */
export class PhaseDetailResponseDto {
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
    description: 'Posicion de esta fase dentro del plan',
    example: 1,
  })
  order: number;

  @ApiProperty({
    description: 'Semanas de esta fase, en el orden en que fueron agregadas',
    type: [WeekDetailResponseDto],
  })
  weeks: WeekDetailResponseDto[];
}
