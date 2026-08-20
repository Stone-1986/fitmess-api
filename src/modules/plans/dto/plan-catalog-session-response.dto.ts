import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO de una sesion dentro del detalle del catalogo (HU-011, CA-011-2):
 * GET /catalog/plans/:id.
 *
 * Expone SOLO la cantidad de ejercicios de la sesion (`exerciseCount`) — no
 * el detalle de cada ejercicio, porque ninguna CA de HU-011 lo pide. Para el
 * detalle completo de ejercicios, el atleta necesita estar suscrito
 * (EPICA-04, fuera de alcance de esta epica).
 */
export class PlanCatalogSessionResponseDto {
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
      'Cantidad de ejercicios que componen la sesion (no se expone el detalle de cada uno)',
    example: 5,
  })
  exerciseCount: number;
}
