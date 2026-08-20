import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlanStatus } from '../../../../generated/prisma/index.js';

/**
 * DTO de respuesta para operaciones sobre Plan que NO necesitan el arbol
 * completo de estructura.
 *
 * Usado en:
 * - HU-008: POST /plans (201), GET /plans (200, un elemento del array), PATCH /plans/:id (200)
 * - HU-009: POST /plans/:id/publish (200), POST /plans/:id/unpublish (200)
 * - HU-010: POST /plans/:id/archive (200)
 *
 * No incluye `phases` — lectura agregada solo en GET /plans/:id (D-8, ver
 * PlanDetailResponseDto).
 *
 * `status` refleja el valor EFECTIVO (decision D-1): si el valor persistido
 * es PUBLISHED pero endDate ya paso, el service retorna FINALIZED aqui sin
 * que el cliente tenga que calcularlo.
 *
 * NUNCA expone: archivedAt (el estado ARCHIVED ya es uno de los cuatro
 * valores de PlanStatus — decision D-7b, no hay campo adicional).
 */
export class PlanResponseDto {
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
    description: 'Descripcion del plan, visible para el atleta en el catalogo',
    example:
      'Bloque de 8 semanas enfocado en fuerza maxima y volumen de hipertrofia para tren inferior.',
    type: String,
    nullable: true,
  })
  description: string | null;

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
    description:
      'Estado efectivo del plan (D-1: si el valor persistido es PUBLISHED pero ' +
      'endDate ya paso, este campo retorna FINALIZED, calculado en el momento de la lectura).',
    enum: PlanStatus,
    example: PlanStatus.DRAFT,
  })
  status: PlanStatus;

  @ApiProperty({
    description: 'UUID del entrenador propietario del plan',
    example: 'a9b8c7d6-e5f4-3210-a9b8-c7d6e5f43210',
    format: 'uuid',
  })
  coachId: string;

  @ApiProperty({
    description: 'Fecha de creacion del plan',
    example: '2026-08-20T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha de ultima actualizacion del plan',
    example: '2026-08-20T10:00:00.000Z',
  })
  updatedAt: Date;
}
