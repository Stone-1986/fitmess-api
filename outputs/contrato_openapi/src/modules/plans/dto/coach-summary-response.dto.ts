import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Perfil publico REDUCIDO del entrenador, embebido en cada item del listado
 * del catalogo (HU-011, CA-011-1): GET /catalog/plans.
 *
 * Campos EXACTOS por decision confirmada del humano (2026-08-20), verificados
 * contra prisma/schema.prisma: id y name (User), avatarUrl (User, opcional).
 *
 * NUNCA expone (Ley 1581/2012 — excluidos explicitamente por la decision
 * confirmada): email, phone, phoneCountryCode, identificationType,
 * identificationNumber, dateOfBirth, passwordHash. Tampoco description ni
 * bannerUrl (CoachRequest) — esos solo aparecen en el perfil COMPLETO del
 * detalle (ver CoachProfileResponseDto), no en el listado.
 */
export class CoachSummaryResponseDto {
  @ApiProperty({
    description: 'UUID del entrenador',
    example: 'a9b8c7d6-e5f4-3210-a9b8-c7d6e5f43210',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Nombre del entrenador',
    example: 'Carlos Andres Rodriguez Perez',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'URL de la foto de perfil del entrenador, si la tiene cargada',
    example: 'https://storage.fitmess.co/avatars/carlos-rodriguez.jpg',
    type: String,
    nullable: true,
  })
  avatarUrl: string | null;
}
