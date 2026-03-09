import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO de respuesta para HU-002: POST /admin-invitations (201 Created)
 *
 * Retorna confirmacion de la invitacion creada.
 *
 * NUNCA expone:
 * - tokenHash — campo interno de seguridad (almacenado hasheado con sha256)
 * - invitedBy — UUID del admin invitante (dato interno de auditoria)
 *
 * El admin invitante ya sabe quien es (es el usuario autenticado).
 * El token RAW es enviado al invitado por email — nunca en la respuesta HTTP.
 */
export class AdminInvitationResponseDto {
  @ApiProperty({
    description: 'UUID de la invitacion recien creada',
    example: '550e8400-e29b-41d4-a716-446655440010',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description:
      'Correo electronico del invitado. Se uso para enviar el enlace de registro.',
    example: 'nuevo.admin@fitmess.co',
    format: 'email',
  })
  email: string;

  @ApiProperty({
    description:
      'Fecha y hora de expiracion del token de invitacion. ' +
      'Configurable via ADMIN_INVITE_EXPIRATION_HOURS (por defecto 48 horas desde la creacion).',
    example: '2026-03-10T14:30:00.000Z',
  })
  expiresAt: Date;

  @ApiProperty({
    description:
      'Fecha y hora de creacion de la invitacion en formato ISO 8601',
    example: '2026-03-08T14:30:00.000Z',
  })
  createdAt: Date;
}
