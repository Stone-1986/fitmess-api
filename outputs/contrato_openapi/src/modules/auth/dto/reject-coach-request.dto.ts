import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * DTO de entrada para HU-002: POST /coach-requests/:id/reject
 *
 * El motivo de rechazo es texto libre ingresado por el administrador.
 * No debe incluir informacion tecnica interna ni datos de otros solicitantes
 * (condicion 2 del Analista de Producto, HU-002).
 */
export class RejectCoachRequestDto {
  @ApiProperty({
    description:
      'Motivo del rechazo de la solicitud. Texto libre del administrador. ' +
      'No debe incluir informacion tecnica interna ni datos de otros solicitantes. ' +
      'El entrenador recibira este mensaje en la notificacion de rechazo.',
    example: 'El perfil no cumple con los requisitos minimos de experiencia requeridos por la plataforma.',
    minLength: 10,
  })
  @IsString({ message: 'El motivo del rechazo debe ser texto' })
  @IsNotEmpty({ message: 'El motivo del rechazo es obligatorio' })
  @MinLength(10, { message: 'El motivo del rechazo debe tener al menos 10 caracteres' })
  reason: string;
}
