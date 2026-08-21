import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionStatus } from '../../../../generated/prisma/index.js';

/**
 * DTO de respuesta resumida para el panel de solicitudes pendientes del
 * entrenador (HU-013, CA-013-3).
 *
 * Usado en: GET /subscriptions/pending (200) — un elemento del array.
 *
 * Forma distinta de SubscriptionResponseDto a proposito (ver plan de
 * implementacion, HU-013): cada item incluye el nombre del atleta y el
 * nombre del plan (resueltos via `include` de solo lectura sobre las
 * relaciones `athlete`/`plan`, D-2) para que el entrenador decida sin tener
 * que consultar cada recurso por separado. `status` siempre es PENDING —
 * la propia query del endpoint filtra por ese estado — se incluye igual
 * por consistencia con el resto de DTOs de respuesta del proyecto.
 *
 * NUNCA expone: ningun otro campo de User (email, telefono, identificacion,
 * passwordHash) mas alla del nombre — mismo criterio de minimizacion ya
 * aplicado a CoachSummaryResponseDto en EPICA-03.
 */
export class SubscriptionPendingSummaryResponseDto {
  @ApiProperty({
    description: 'UUID de la suscripcion pendiente',
    example: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'UUID del atleta solicitante',
    example: 'c3d4e5f6-a7b8-9012-cdef-345678901234',
    format: 'uuid',
  })
  athleteId: string;

  @ApiProperty({
    description: 'Nombre del atleta solicitante',
    example: 'Maria Fernanda Lopez Castro',
  })
  athleteName: string;

  @ApiProperty({
    description: 'UUID del plan al que se solicita la inscripcion',
    example: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
    format: 'uuid',
  })
  planId: string;

  @ApiProperty({
    description: 'Nombre del plan al que se solicita la inscripcion',
    example: 'Fuerza e hipertrofia — bloque 1',
  })
  planName: string;

  @ApiProperty({
    description: 'Estado de la suscripcion — siempre Pendiente en este listado',
    enum: SubscriptionStatus,
    example: SubscriptionStatus.PENDING,
  })
  status: SubscriptionStatus;

  @ApiProperty({
    description: 'Fecha en que el atleta solicito la inscripcion',
    example: '2026-08-20T10:00:00.000Z',
  })
  createdAt: Date;
}
