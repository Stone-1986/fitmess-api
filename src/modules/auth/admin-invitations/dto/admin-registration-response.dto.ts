import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../../../generated/prisma/index.js';

/**
 * DTO de respuesta para HU-003: POST /auth/admin/register (201 Created)
 *
 * Retorna los datos del administrador recien creado para confirmar el registro.
 * El administrador debe autenticarse con POST /auth/login despues del registro.
 *
 * NO reutiliza AthleteRegistrationResponseDto aunque la estructura sea similar.
 * Los DTOs de respuesta son contratos de API — compartirlos acopla sus evoluciones
 * futuras (decision arquitectonica EPICA-09).
 *
 * NUNCA expone:
 * - passwordHash — nunca en ninguna respuesta
 * - archivedAt — campo interno de soft-delete
 * - tokens — el admin autentica via POST /auth/login
 * - phone, phoneCountryCode — datos personales no necesarios en la confirmacion
 */
export class AdminRegistrationResponseDto {
  @ApiProperty({
    description: 'UUID del usuario administrador recien creado',
    example: '550e8400-e29b-41d4-a716-446655440020',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Nombre completo del administrador',
    example: 'Carlos Andres Ramirez Ospina',
  })
  name: string;

  @ApiProperty({
    description:
      'Correo electronico del administrador. Usado para iniciar sesion.',
    example: 'carlos.ramirez@fitmess.co',
    format: 'email',
  })
  email: string;

  @ApiProperty({
    description: 'Rol asignado al usuario. Siempre ADMIN para este endpoint.',
    enum: UserRole,
    example: UserRole.ADMIN,
  })
  role: UserRole;

  @ApiPropertyOptional({
    description: 'Fecha de nacimiento del administrador en formato ISO 8601',
    example: '1985-06-15',
    format: 'date',
  })
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description: 'URL de la foto de perfil del administrador',
    example: 'https://storage.fitmess.co/avatars/carlos-ramirez.jpg',
    format: 'uri',
  })
  avatarUrl?: string;

  @ApiProperty({
    description: 'Fecha de creacion del registro en formato ISO 8601',
    example: '2026-03-08T14:30:00.000Z',
  })
  createdAt: Date;
}
