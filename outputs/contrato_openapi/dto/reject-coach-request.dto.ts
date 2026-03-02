import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * DTO de entrada para el rechazo de una solicitud de entrenador (HU-002).
 *
 * Endpoint: POST /coach-requests/:id/reject
 * Acceso: exclusivo para ADMIN
 *
 * El motivo de rechazo es texto libre que se persiste en CoachRequest.rejectionReason
 * y se envía al coach a través del evento coach.request.rejected.
 *
 * IMPORTANTE: El motivo NO debe contener información técnica interna del sistema
 * (CA-5 HU-002, Ley 1273/2009).
 */
export class RejectCoachRequestDto {
  @ApiProperty({
    description:
      'Motivo del rechazo de la solicitud. Texto libre orientado al coach — no incluir información técnica interna.',
    example:
      'La descripción del plan no cumple con los estándares mínimos requeridos por la plataforma. Por favor adjunte certificaciones y un plan de entrenamiento más detallado.',
    minLength: 10,
    maxLength: 1000,
  })
  @IsString({ message: 'El motivo de rechazo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El motivo de rechazo es obligatorio' })
  @MinLength(10, { message: 'El motivo de rechazo debe tener al menos 10 caracteres' })
  @MaxLength(1000, { message: 'El motivo de rechazo no puede superar 1000 caracteres' })
  rejectionReason: string;
}
