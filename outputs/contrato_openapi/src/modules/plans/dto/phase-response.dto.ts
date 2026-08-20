import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO de respuesta estandalone para HU-008: POST /plans/:id/phases (201).
 *
 * No incluye `weeks` — la escritura es granular (D-8). Para el arbol
 * completo, usar GET /plans/:id (ver PhaseDetailResponseDto).
 *
 * No incluye planId — el cliente ya lo conoce por la URL con la que creo la fase.
 */
export class PhaseResponseDto {
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
    description:
      'Posicion de esta fase dentro del plan (calculada server-side, D-5)',
    example: 1,
  })
  order: number;

  @ApiProperty({
    description: 'Fecha de creacion de la fase',
    example: '2026-08-20T10:00:00.000Z',
  })
  createdAt: Date;
}
