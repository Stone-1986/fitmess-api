import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO de respuesta estandalone para HU-008: POST /plans/:id/weeks/:weekId/sessions (201).
 *
 * No incluye `exercises` — la escritura es granular (D-8): agregar ejercicios
 * a la sesion es una operacion incremental aparte
 * (POST /plans/:id/sessions/:sessionId/exercises). Para el arbol completo,
 * usar GET /plans/:id (ver SessionDetailResponseDto).
 *
 * No incluye weekId — el cliente ya lo conoce por la URL con la que creo
 * la sesion.
 */
export class SessionResponseDto {
  @ApiProperty({
    description: 'UUID de la sesion',
    example: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Nombre de la sesion',
    example: 'Dia 1 — Tren inferior (fuerza)',
  })
  name: string;

  @ApiProperty({
    description:
      'Posicion de esta sesion dentro de la semana (calculada server-side, D-5)',
    example: 1,
  })
  order: number;

  @ApiProperty({
    description: 'Fecha de creacion de la sesion',
    example: '2026-08-20T10:00:00.000Z',
  })
  createdAt: Date;
}
