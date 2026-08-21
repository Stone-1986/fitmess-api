import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionStatus } from '../../../../generated/prisma/index.js';

/**
 * DTO de respuesta para operaciones sobre Subscription desde el punto de
 * vista del propio atleta o del entrenador que la resuelve.
 *
 * Usado en:
 * - HU-012: POST /subscriptions (201)
 * - HU-014: GET /subscriptions (200, un elemento del array)
 * - HU-013: POST /subscriptions/:id/approve (200), POST /subscriptions/:id/reject (200)
 * - HU-014: POST /subscriptions/:id/accept-consent (200)
 *
 * NUNCA expone: `reviewedBy` (UUID interno del entrenador que aprobo/rechazo
 * — mismo criterio ya aplicado a CoachRequestSummaryResponseDto en EPICA-01,
 * campo de auditoria no destinado al cliente). Tampoco expone datos del
 * documento de consentimiento (D-8) ni ningun dato de salud — Subscription
 * no los contiene.
 */
export class SubscriptionResponseDto {
  @ApiProperty({
    description: 'UUID de la suscripcion',
    example: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'UUID del atleta titular de la suscripcion',
    example: 'c3d4e5f6-a7b8-9012-cdef-345678901234',
    format: 'uuid',
  })
  athleteId: string;

  @ApiProperty({
    description: 'UUID del plan al que corresponde la suscripcion',
    example: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
    format: 'uuid',
  })
  planId: string;

  @ApiProperty({
    description:
      'Estado de la suscripcion. Aprobada es, a proposito, una via muerta valida ' +
      'del enum cuando el plan referenciado deja de estar vigente antes de que el ' +
      'atleta acepte el consentimiento (CA-014-8, D-10) — no existe un quinto estado ' +
      'para representar ese bloqueo.',
    enum: SubscriptionStatus,
    example: SubscriptionStatus.PENDING,
  })
  status: SubscriptionStatus;

  @ApiPropertyOptional({
    description:
      'Momento en que el entrenador aprobo o rechazo la solicitud. Solo presente ' +
      'cuando status ya no es Pendiente.',
    example: '2026-08-21T09:15:00.000Z',
    type: String,
    nullable: true,
  })
  reviewedAt: Date | null;

  @ApiPropertyOptional({
    description:
      'Momento en que el atleta acepto el consentimiento informado deportivo y la ' +
      'suscripcion transiciono a Activa (CA-014-2). Solo presente cuando status = ACTIVE.',
    example: '2026-08-22T14:30:00.000Z',
    type: String,
    nullable: true,
  })
  activatedAt: Date | null;

  @ApiProperty({
    description: 'Fecha de creacion de la suscripcion (momento de la solicitud)',
    example: '2026-08-20T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha de ultima actualizacion de la suscripcion',
    example: '2026-08-22T14:30:00.000Z',
  })
  updatedAt: Date;
}
