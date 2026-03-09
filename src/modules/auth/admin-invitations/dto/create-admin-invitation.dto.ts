import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

/**
 * DTO de entrada para HU-002: POST /admin-invitations
 *
 * Crea una invitacion de administrador. Solo campos estrictamente necesarios.
 * El admin invitante se toma del JWT (@CurrentUser) — no lo recibe el cliente.
 * El token se genera internamente con randomBytes(32) — no lo recibe el cliente.
 *
 * Guardrails legales:
 * - Ley 1273/2009: el email se usa exclusivamente para enviar la invitacion
 *   (finalidad declarada). No se expone en la respuesta al exterior.
 */
export class CreateAdminInvitationDto {
  @ApiProperty({
    description:
      'Correo electronico de la persona a invitar como administrador. ' +
      'No debe existir un User activo ni una invitacion activa (no expirada, no utilizada) ' +
      'para este correo en la plataforma.',
    example: 'nuevo.admin@fitmess.co',
    format: 'email',
  })
  @IsEmail({}, { message: 'El correo electronico no tiene un formato valido' })
  @IsNotEmpty({ message: 'El correo electronico es obligatorio' })
  email: string;
}
