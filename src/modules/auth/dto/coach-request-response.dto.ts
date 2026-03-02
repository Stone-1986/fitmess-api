import { ApiProperty } from '@nestjs/swagger';
import { CoachRequestStatus } from '../enums/coach-request-status.enum.js';

/**
 * DTO de respuesta para operaciones sobre CoachRequest.
 *
 * Usado en:
 * - HU-001: POST /auth/coaches/register (201) — respuesta inicial de solicitud
 * - HU-002: POST /coach-requests/:id/approve (200)
 * - HU-002: POST /coach-requests/:id/reject (200)
 * - HU-002: POST /coach-requests/search (200, array)
 *
 * NUNCA expone: archivedAt, passwordHash, tokens, rejectionReason (campo interno).
 */
export class CoachRequestResponseDto {
  @ApiProperty({
    description: 'UUID de la solicitud de registro del entrenador',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'Estado actual de la solicitud en la state machine',
    enum: CoachRequestStatus,
    example: CoachRequestStatus.PENDING,
  })
  status: CoachRequestStatus;

  @ApiProperty({
    description: 'Fecha y hora de creacion de la solicitud',
    example: '2026-03-01T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Mensaje informativo para el solicitante',
    example: 'Solicitud recibida. El administrador revisara tu perfil.',
  })
  message: string;
}
