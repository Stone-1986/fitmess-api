import { ApiProperty } from '@nestjs/swagger';
import { SessionDetailResponseDto } from './session-detail-response.dto.js';

/**
 * DTO de una semana embebida en el arbol completo de GET /plans/:id (D-8).
 *
 * A diferencia de WeekResponseDto (respuesta de la creacion incremental),
 * este SI incluye `sessions`.
 */
export class WeekDetailResponseDto {
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
    type: [SessionDetailResponseDto],
  })
  sessions: SessionDetailResponseDto[];
}
