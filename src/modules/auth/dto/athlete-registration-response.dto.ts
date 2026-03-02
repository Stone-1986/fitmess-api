import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../generated/prisma/index.js';
import { IdentificationType } from '../enums/identification-type.enum.js';

/**
 * DTO de respuesta para HU-003: POST /auth/register
 *
 * Retorna los datos del atleta registrado para confirmar el registro.
 * NUNCA expone: passwordHash, tokens, archivedAt ni datos internos de auditoria.
 *
 * NO se incluyen tokens de acceso en el registro — el atleta debe
 * autenticarse con POST /auth/login despues del registro.
 */
export class AthleteRegistrationResponseDto {
  @ApiProperty({
    description: 'UUID del usuario atleta recien creado',
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
    description: 'Correo electronico del atleta registrado',
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
    description: 'Tipo de documento de identificacion',
    enum: IdentificationType,
    example: IdentificationType.CC,
  })
  identificationType: IdentificationType;

  @ApiProperty({
    description: 'Numero de documento de identificacion',
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
    description: 'Fecha de creacion del registro en formato ISO 8601',
    example: '2026-03-01T10:30:00.000Z',
  })
  createdAt: Date;
}
