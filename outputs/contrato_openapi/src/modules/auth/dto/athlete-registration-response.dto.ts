import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO de respuesta para HU-003: POST /auth/register
 *
 * Retorna los datos minimos necesarios para confirmar el registro del atleta.
 * NUNCA expone: passwordHash, tokens, archivedAt ni datos internos de auditoria.
 */
export class AthleteRegistrationResponseDto {
  @ApiProperty({
    description: 'UUID del usuario registrado',
    example: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
  })
  id: string;

  @ApiProperty({
    description: 'Correo electronico del atleta registrado',
    example: 'atleta@ejemplo.com',
  })
  email: string;

  @ApiProperty({
    description: 'Rol asignado al usuario',
    example: 'ATHLETE',
  })
  role: string;

  @ApiProperty({
    description: 'Fecha y hora de creacion del usuario',
    example: '2026-03-01T10:00:00.000Z',
  })
  createdAt: Date;
}
