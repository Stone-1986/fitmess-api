import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Perfil publico COMPLETO del entrenador, embebido en el detalle de un plan
 * del catalogo (HU-011, CA-011-2): GET /catalog/plans/:id.
 *
 * Campos EXACTOS por decision confirmada del humano (2026-08-20), verificados
 * contra prisma/schema.prisma: id, name, avatarUrl (User, opcional);
 * description (mapeado de CoachRequest.planDescription, opcional) y
 * bannerUrl (mapeado de CoachRequest.bannerUrl, opcional). description y
 * bannerUrl quedan null si el entrenador no tiene una CoachRequest en estado
 * APPROVED (decision D-2b) — el plan sigue visible, el perfil solo aparece
 * incompleto.
 *
 * ADVERTENCIA LEGAL (Ley 1581/2012, hallazgo del Analista de Producto,
 * bloqueante para produccion — ver reporte_validacion_negocio.yaml):
 * CoachRequest.planDescription se recogio bajo la finalidad textual "el
 * administrador revisara" (register-coach.dto.ts), mas estrecha que
 * "exhibicion publica a atletas en el catalogo". Antes de exponer este
 * campo en produccion, el negocio debe (a) actualizar la finalidad
 * informada al entrenador en el flujo de registro y (b) decidir como
 * notificar el cambio de finalidad a entrenadores ya aprobados. Esta
 * condicion NO bloquea la construccion del contrato ni del codigo — bloquea
 * la EXPOSICION del catalogo en produccion sin esa decision documentada.
 *
 * NUNCA expone (Ley 1581/2012): email, phone, phoneCountryCode,
 * identificationType, identificationNumber, dateOfBirth, passwordHash.
 */
export class CoachProfileResponseDto {
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

  @ApiPropertyOptional({
    description:
      'Descripcion de la propuesta de entrenamiento del entrenador (CoachRequest.planDescription). ' +
      'null si el entrenador no tiene una CoachRequest en estado APPROVED (D-2b). ' +
      'Sujeto a la advertencia legal de Ley 1581/2012 declarada en el reporte de validacion de producto.',
    example:
      'Entrenador certificado en fuerza y acondicionamiento con 8 anos de experiencia en powerlifting y periodizacion deportiva.',
    type: String,
    nullable: true,
  })
  description: string | null;

  @ApiPropertyOptional({
    description:
      'URL del banner del entrenador (CoachRequest.bannerUrl). null si el entrenador ' +
      'no tiene una CoachRequest en estado APPROVED, o si no cargo banner (D-2b).',
    example: 'https://storage.fitmess.co/banners/carlos-rodriguez.jpg',
    type: String,
    nullable: true,
  })
  bannerUrl: string | null;
}
