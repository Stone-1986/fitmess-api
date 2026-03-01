import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CoachRequestStatus } from '../enums/coach-request-status.enum';
import { IdentificationType } from '../enums/identification-type.enum';

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

  // ── Datos del solicitante (de User) ────────────────────────────────────────

  @ApiProperty({
    description: 'UUID del usuario solicitante',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  })
  userId: string;

  @ApiProperty({
    description: 'Nombre completo del solicitante',
    example: 'Carlos Andres Ramirez',
  })
  name: string;

  @ApiProperty({
    description: 'Correo electronico del solicitante',
    example: 'coach@ejemplo.com',
  })
  email: string;

  @ApiProperty({
    description: 'Indicativo internacional del pais del numero de telefono',
    example: '+57',
  })
  phoneCountryCode: string;

  @ApiProperty({
    description: 'Numero de telefono del solicitante',
    example: '3001234567',
  })
  phone: string;

  @ApiProperty({
    description: 'Tipo de documento de identificacion',
    enum: IdentificationType,
    example: IdentificationType.CC,
  })
  identificationType: IdentificationType;

  @ApiProperty({
    description: 'Numero de documento de identificacion',
    example: '1023456789',
  })
  identificationNumber: string;

  @ApiPropertyOptional({
    description: 'URL del avatar del solicitante',
    example: 'https://storage.ejemplo.com/avatars/coach-001.jpg',
  })
  avatarUrl?: string;

  // ── Datos de la solicitud (de CoachRequest) ────────────────────────────────

  @ApiProperty({
    description: 'Descripcion del plan de trabajo y metodologia del entrenador',
    example: 'Especialista en fuerza y acondicionamiento con 5 anos de experiencia en powerlifting.',
  })
  planDescription: string;

  @ApiPropertyOptional({
    description: 'URL del banner de perfil del entrenador',
    example: 'https://storage.ejemplo.com/banners/coach-001-banner.jpg',
  })
  bannerUrl?: string;

  @ApiPropertyOptional({
    description: 'Motivo del rechazo si la solicitud fue rechazada. Solo visible para el administrador.',
    example: 'El perfil no cumple con los requisitos minimos de experiencia.',
  })
  rejectionReason?: string;

  @ApiPropertyOptional({
    description: 'Fecha y hora en que la solicitud fue revisada (aprobada o rechazada)',
    example: '2026-03-02T14:30:00.000Z',
  })
  reviewedAt?: Date;

  @ApiProperty({
    description: 'Fecha y hora de creacion de la solicitud',
    example: '2026-03-01T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha y hora de la ultima actualizacion de la solicitud',
    example: '2026-03-02T14:30:00.000Z',
  })
  updatedAt: Date;
}
