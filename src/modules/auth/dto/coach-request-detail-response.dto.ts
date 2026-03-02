import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CoachRequestStatus,
  IdentificationType,
} from '../../../../generated/prisma/index.js';

/**
 * DTO de respuesta detallada para HU-002: GET /coach-requests/:id
 *
 * Incluye todos los campos necesarios para la revision del administrador:
 * datos del solicitante (de User) y datos de la solicitud (de CoachRequest).
 *
 * NUNCA expone: archivedAt, passwordHash, tokens, reviewedBy (campo interno de auditoria).
 */
export class CoachRequestDetailResponseDto {
  @ApiProperty({
    description: 'UUID de la solicitud',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'UUID del usuario coach',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  userId: string;

  @ApiProperty({
    description: 'Nombre completo del coach solicitante',
    example: 'Carlos Andres Gomez Ruiz',
  })
  coachName: string;

  @ApiProperty({
    description: 'Correo electronico del coach solicitante',
    example: 'carlos.gomez@ejemplo.com',
    format: 'email',
  })
  coachEmail: string;

  @ApiProperty({
    description: 'Tipo de documento de identificacion',
    enum: IdentificationType,
    example: IdentificationType.CC,
  })
  identificationType: IdentificationType;

  @ApiProperty({
    description: 'Numero de documento de identificacion',
    example: '1020304050',
  })
  identificationNumber: string;

  @ApiProperty({
    description: 'Numero de telefono del coach',
    example: '3101234567',
  })
  phone: string;

  @ApiProperty({
    description: 'Codigo de pais del telefono',
    example: '57',
  })
  phoneCountryCode: string;

  @ApiPropertyOptional({
    description: 'Fecha de nacimiento del coach en formato ISO 8601',
    example: '1990-06-15',
    format: 'date',
  })
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description: 'URL de la foto de perfil del coach',
    example: 'https://storage.fitmess.co/avatars/carlos-gomez.jpg',
    format: 'uri',
  })
  avatarUrl?: string;

  @ApiProperty({
    description: 'Estado actual de la solicitud en la state machine',
    enum: CoachRequestStatus,
    example: CoachRequestStatus.PENDING,
  })
  status: CoachRequestStatus;

  @ApiProperty({
    description: 'Descripcion del plan de entrenamiento que ofrece el coach',
    example:
      'Entrenador certificado NSCA con 5 anos de experiencia en fuerza y acondicionamiento. Especializado en atletas de alto rendimiento.',
  })
  planDescription: string;

  @ApiPropertyOptional({
    description: 'URL del banner o portafolio del coach',
    example: 'https://storage.fitmess.co/banners/carlos-gomez-banner.jpg',
    format: 'uri',
  })
  bannerUrl?: string;

  @ApiPropertyOptional({
    description: 'Motivo de rechazo. Solo presente cuando status = REJECTED.',
    example:
      'La descripcion del plan no cumple con los estandares minimos requeridos.',
  })
  rejectionReason?: string;

  @ApiPropertyOptional({
    description:
      'Fecha en que el administrador reviso la solicitud. Solo presente cuando status = APPROVED o REJECTED.',
    example: '2026-03-05T14:20:00.000Z',
  })
  reviewedAt?: Date;

  @ApiProperty({
    description: 'Fecha de creacion de la solicitud en formato ISO 8601',
    example: '2026-03-01T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha de ultima actualizacion en formato ISO 8601',
    example: '2026-03-05T14:20:00.000Z',
  })
  updatedAt: Date;
}
