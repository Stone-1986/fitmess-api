import { ApiProperty } from '@nestjs/swagger';
import { CoachRequestStatus } from '../enums/coach-request-status.enum';

/**
 * DTO de respuesta ligera para operaciones sobre CoachRequest (HU-001, HU-002).
 *
 * Usado en:
 * - POST /auth/coaches/register (201) — confirmación al coach tras su registro
 * - POST /coach-requests/:id/approve (200) — confirmación al admin tras aprobar
 * - POST /coach-requests/:id/reject (200) — confirmación al admin tras rechazar
 *
 * Decisión de diseño: se retorna una respuesta ligera {id, status, createdAt, message}
 * porque estos endpoints son operaciones de escritura donde el cliente solo necesita
 * confirmar que la acción fue exitosa. El detalle completo se obtiene vía
 * GET /coach-requests/:id (CoachRequestDetailResponseDto).
 *
 * Campos excluidos intencionalmente (rulesArquitectura.md):
 * - passwordHash: dato sensible de seguridad
 * - archivedAt: campo interno de soft-delete
 * - reviewedBy: UUID interno del admin — no se expone al cliente
 */
export class CoachRequestResponseDto {
  @ApiProperty({
    description: 'UUID de la solicitud de registro como entrenador',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Estado actual de la solicitud en la máquina de estados',
    enum: CoachRequestStatus,
    example: CoachRequestStatus.PENDING,
  })
  status: CoachRequestStatus;

  @ApiProperty({
    description: 'Fecha de creación de la solicitud en formato ISO 8601',
    example: '2026-03-01T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description:
      'Mensaje informativo sobre el resultado de la operación. Ej: "Solicitud recibida. El administrador revisará tu perfil."',
    example: 'Solicitud recibida. El administrador revisará tu perfil.',
  })
  message: string;
}
