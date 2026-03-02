import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../enums/user-role.enum';
import { IdentificationType } from '../enums/identification-type.enum';

/**
 * DTO de respuesta para el registro exitoso de un atleta (HU-003).
 *
 * Campos excluidos intencionalmente (rulesArquitectura.md):
 * - passwordHash: dato sensible de seguridad, nunca exponer
 * - archivedAt: campo interno de soft-delete
 *
 * NO se incluyen tokens de acceso en el registro — el atleta debe
 * autenticarse con POST /auth/login después del registro.
 */
export class AthleteRegistrationResponseDto {
  @ApiProperty({
    description: 'UUID del usuario atleta recién creado',
    example: '550e8400-e29b-41d4-a716-446655440001',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Nombre completo del atleta',
    example: 'Laura Valentina Torres Medina',
  })
  name: string;

  @ApiProperty({
    description: 'Correo electrónico del atleta',
    example: 'laura.torres@ejemplo.com',
    format: 'email',
  })
  email: string;

  @ApiProperty({
    description: 'Rol asignado al usuario',
    enum: UserRole,
    example: UserRole.ATHLETE,
  })
  role: UserRole;

  @ApiProperty({
    description: 'Tipo de documento de identificación',
    enum: IdentificationType,
    example: IdentificationType.CC,
  })
  identificationType: IdentificationType;

  @ApiProperty({
    description: 'Número de documento de identificación',
    example: '1010203040',
  })
  identificationNumber: string;

  @ApiPropertyOptional({
    description: 'Fecha de nacimiento del atleta en formato ISO 8601',
    example: '1998-11-22',
    format: 'date',
  })
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description: 'URL de la foto de perfil del atleta',
    example: 'https://storage.fitmess.co/avatars/laura-torres.jpg',
    format: 'uri',
  })
  avatarUrl?: string;

  @ApiProperty({
    description: 'Fecha de creación del registro en formato ISO 8601',
    example: '2026-03-01T10:30:00.000Z',
  })
  createdAt: Date;
}
