import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CoachRequestStatus } from '../enums/coach-request-status.enum';
import { IdentificationType } from '../enums/identification-type.enum';

/**
 * DTO de respuesta con detalle completo de una solicitud de entrenador (HU-002).
 *
 * Usado en: GET /coach-requests/:id (200)
 *
 * Incluye todos los datos necesarios para que el administrador tome
 * la decisión de aprobar o rechazar la solicitud. Contiene más campos
 * que CoachRequestSummaryResponseDto (planDescription, avatarUrl, dateOfBirth).
 *
 * Campos excluidos intencionalmente (rulesArquitectura.md):
 * - passwordHash: dato sensible de seguridad
 * - archivedAt: campo interno de soft-delete
 * - reviewedBy: UUID interno del admin — no se expone
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
    example: 'Carlos Andrés Gómez Ruiz',
  })
  coachName: string;

  @ApiProperty({
    description: 'Correo electrónico del coach solicitante',
    example: 'carlos.gomez@ejemplo.com',
    format: 'email',
  })
  coachEmail: string;

  @ApiProperty({
    description: 'Tipo de documento de identificación',
    enum: IdentificationType,
    example: IdentificationType.CC,
  })
  identificationType: IdentificationType;

  @ApiProperty({
    description: 'Número de documento de identificación',
    example: '1020304050',
  })
  identificationNumber: string;

  @ApiProperty({
    description: 'Número de teléfono del coach',
    example: '3101234567',
  })
  phone: string;

  @ApiProperty({
    description: 'Código de país del teléfono',
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
    description: 'Estado actual de la solicitud en la máquina de estados',
    enum: CoachRequestStatus,
    example: CoachRequestStatus.PENDING,
  })
  status: CoachRequestStatus;

  @ApiProperty({
    description: 'Descripción del plan de entrenamiento que ofrece el coach',
    example: 'Entrenador certificado NSCA con 5 años de experiencia en fuerza y acondicionamiento. Especializado en atletas de alto rendimiento.',
  })
  planDescription: string;

  @ApiPropertyOptional({
    description: 'URL del banner o portafolio del coach',
    example: 'https://storage.fitmess.co/banners/carlos-gomez-banner.jpg',
    format: 'uri',
  })
  bannerUrl?: string;

  @ApiPropertyOptional({
    description:
      'Motivo de rechazo. Solo presente cuando status = REJECTED.',
    example: 'La descripción del plan no cumple con los estándares mínimos requeridos.',
  })
  rejectionReason?: string;

  @ApiPropertyOptional({
    description:
      'Fecha en que el administrador revisó la solicitud. Solo presente cuando status = APPROVED o REJECTED.',
    example: '2026-03-05T14:20:00.000Z',
  })
  reviewedAt?: Date;

  @ApiProperty({
    description: 'Fecha de creación de la solicitud en formato ISO 8601',
    example: '2026-03-01T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha de última actualización en formato ISO 8601',
    example: '2026-03-05T14:20:00.000Z',
  })
  updatedAt: Date;
}
