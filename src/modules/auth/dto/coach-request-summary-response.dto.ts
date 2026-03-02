import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CoachRequestStatus,
  IdentificationType,
} from '../../../../generated/prisma/index.js';

/**
 * DTO de respuesta resumida para el listado de solicitudes de entrenadores (HU-002).
 *
 * Usado en: POST /coach-requests/search (200) — un elemento del array de resultados.
 *
 * Contiene los campos necesarios para que el administrador identifique
 * rapidamente las solicitudes en la lista. Para el detalle completo
 * → GET /coach-requests/:id (CoachRequestDetailResponseDto).
 *
 * Campos excluidos intencionalmente (rulesArquitectura.md):
 * - passwordHash: dato sensible de seguridad
 * - archivedAt: campo interno de soft-delete
 * - reviewedBy: UUID interno del admin
 * - planDescription: incluido solo en el detalle
 */
export class CoachRequestSummaryResponseDto {
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
    description: 'Estado actual de la solicitud',
    enum: CoachRequestStatus,
    example: CoachRequestStatus.PENDING,
  })
  status: CoachRequestStatus;

  @ApiPropertyOptional({
    description: 'URL del banner del coach',
    example: 'https://storage.fitmess.co/banners/carlos-gomez-banner.jpg',
    format: 'uri',
  })
  bannerUrl?: string;

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
}
