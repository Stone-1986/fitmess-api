import { ApiProperty } from '@nestjs/swagger';

/**
 * Estado derivado de una invitacion de administrador.
 *
 * No se persiste en base de datos — se calcula en el service:
 *   USED    si tokenUsedAt != null
 *   EXPIRED si expiresAt < now()
 *   ACTIVE  en caso contrario
 */
export type AdminInvitationStatus = 'ACTIVE' | 'EXPIRED' | 'USED';

/**
 * DTO de respuesta para HU-003: POST /admin-invitations/verify (200 OK)
 *
 * Permite al frontend verificar el estado de la invitacion antes de
 * mostrar el formulario de registro. El token fue buscado por su hash sha256.
 *
 * NUNCA expone:
 * - tokenHash — campo interno de seguridad
 * - invitedBy — UUID del admin invitante (dato interno, sin valor para el invitado)
 *
 * Guardrails legales:
 * - Ley 1273/2009 (anti-enumeracion): 404 para tokens inexistentes Y adulterados.
 *   Solo se llega a este DTO cuando el token es valido (existe en DB).
 *   El 422 (EXPIRED) y 409 (USED) se emiten como errores, no via este DTO.
 */
export class AdminInvitationStatusResponseDto {
  @ApiProperty({
    description:
      'Correo electronico del invitado asociado a este token de invitacion.',
    example: 'nuevo.admin@fitmess.co',
    format: 'email',
  })
  email: string;

  @ApiProperty({
    description:
      'Estado derivado de la invitacion. ' +
      'ACTIVE: vigente y disponible para registro. ' +
      'EXPIRED: expiresAt < now() — solicitar nueva invitacion. ' +
      'USED: tokenUsedAt != null — la cuenta ya fue creada.',
    example: 'ACTIVE',
    enum: ['ACTIVE', 'EXPIRED', 'USED'],
  })
  status: AdminInvitationStatus;

  @ApiProperty({
    description:
      'Fecha y hora de expiracion del token. Permite al frontend mostrar cuenta regresiva.',
    example: '2026-03-10T14:30:00.000Z',
  })
  expiresAt: Date;
}
