import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * DTO de entrada para HU-002: POST /coach-requests/:id/reject
 *
 * El motivo de rechazo es texto libre ingresado por el administrador.
 * No debe incluir informacion tecnica interna ni datos de otros solicitantes
 * (Ley 1273/2009).
 */
export class RejectCoachRequestDto {
  @ApiProperty({
    description:
      'Motivo del rechazo de la solicitud. Texto libre orientado al coach — no incluir informacion tecnica interna.',
    example:
      'La descripcion del plan no cumple con los estandares minimos requeridos por la plataforma. Por favor adjunte certificaciones y un plan de entrenamiento mas detallado.',
    minLength: 10,
    maxLength: 1000,
  })
  @IsString({ message: 'El motivo de rechazo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El motivo de rechazo es obligatorio' })
  @MinLength(10, {
    message: 'El motivo de rechazo debe tener al menos 10 caracteres',
  })
  @MaxLength(1000, {
    message: 'El motivo de rechazo no puede superar 1000 caracteres',
  })
  rejectionReason: string;
}
