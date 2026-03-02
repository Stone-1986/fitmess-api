import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../generated/prisma/index.js';

/**
 * DTO anidado con datos minimos del usuario autenticado.
 * Incluido en AuthTokenResponseDto.
 */
export class AuthUserDto {
  @ApiProperty({
    description: 'UUID del usuario autenticado',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Correo electronico del usuario autenticado',
    example: 'carlos.gomez@ejemplo.com',
    format: 'email',
  })
  email: string;

  @ApiProperty({
    description: 'Rol del usuario autenticado',
    enum: UserRole,
    example: UserRole.COACH,
  })
  role: UserRole;
}

/**
 * DTO de respuesta para HU-004: POST /auth/login
 *
 * Estructura anidada: incluye datos del usuario en un objeto `user` separado
 * y `expiresIn` para que el cliente conozca la vigencia del token sin
 * decodificar el JWT.
 *
 * IMPORTANTE: El refreshToken se incluye aqui porque es necesario para que
 * el cliente pueda renovar el accessToken. Sin embargo, NUNCA se loggea
 * ninguno de los dos tokens en los logs del servidor (rulesArquitectura.md).
 *
 * El accessToken JWT expira en un tiempo configurado. El cliente debe
 * almacenar el refreshToken de forma segura (httpOnly cookie recomendada).
 */
export class AuthTokenResponseDto {
  @ApiProperty({
    description:
      'Token JWT de acceso. Debe incluirse en el header Authorization: Bearer <token>',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description:
      'Token de refresco para obtener un nuevo accessToken cuando este expire. Almacenar de forma segura.',
    example: 'rt_a1b2c3d4e5f6...',
  })
  refreshToken: string;

  @ApiProperty({
    description:
      'Tiempo de expiracion del accessToken en segundos. Permite al cliente programar la renovacion sin decodificar el JWT.',
    example: 3600,
  })
  expiresIn: number;

  @ApiProperty({
    description: 'Datos basicos del usuario autenticado',
    type: AuthUserDto,
  })
  user: AuthUserDto;
}
