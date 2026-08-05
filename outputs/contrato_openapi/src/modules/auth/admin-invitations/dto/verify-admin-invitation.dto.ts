import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * DTO de entrada para HU-003: POST /admin-invitations/verify
 *
 * Verifica el estado de un token de invitacion antes de mostrar el formulario
 * de registro al invitado.
 *
 * El token se recibe en el body (no en URL) para evitar exposicion en:
 * - Access logs del servidor (nginx, load balancers)
 * - Historial del navegador
 * - Headers Referer
 *
 * Patron consistente con OAuth 2.0 Token Introspection (RFC 7662)
 * y con POST /auth/admin/register (misma decision de seguridad).
 *
 * Guardrails legales:
 * - Ley 1273/2009: token sensible nunca en URL ni en logs.
 */
export class VerifyAdminInvitationDto {
  @ApiProperty({
    description:
      'Token de invitacion recibido por correo electronico. ' +
      'El service hashea este token con sha256 para buscar en base de datos. ' +
      'NUNCA se loggea — Ley 1273/2009.',
    example: 'a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1',
    minLength: 64,
    maxLength: 64,
  })
  @IsString()
  @IsNotEmpty({ message: 'El token de invitacion es obligatorio' })
  @MinLength(64, {
    message: 'El token de invitacion no tiene el formato esperado',
  })
  @MaxLength(64, {
    message: 'El token de invitacion no tiene el formato esperado',
  })
  token: string;
}
