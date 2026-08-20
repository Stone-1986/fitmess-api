import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO de respuesta estandalone para HU-008: POST /plans/:id/phases/:phaseId/weeks (201).
 *
 * No incluye `sessions` — la escritura es granular (D-8). Para el arbol
 * completo, usar GET /plans/:id (ver WeekDetailResponseDto).
 *
 * No incluye phaseId — el cliente ya lo conoce por la URL con la que creo
 * la semana.
 */
export class WeekResponseDto {
  @ApiProperty({
    description: 'UUID de la semana',
    example: 'd4e5f6a7-b8c9-0123-defa-234567890123',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description:
      'Numero de la semana, secuencial a lo largo de TODO el plan (no reinicia ' +
      'por fase) — calculado server-side (decision D-4, necesario para EPICA-05).',
    example: 1,
  })
  weekNumber: number;

  @ApiProperty({
    description: 'Fecha de creacion de la semana',
    example: '2026-08-20T10:00:00.000Z',
  })
  createdAt: Date;
}
