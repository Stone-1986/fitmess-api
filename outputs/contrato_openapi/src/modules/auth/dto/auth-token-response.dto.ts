import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO anidado con datos minimos del usuario autenticado.
 * Incluido en AuthTokenResponseDto.
 */
export class AuthUserDto {
  @ApiProperty({
    description: 'UUID del usuario autenticado',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'Correo electronico del usuario',
    example: 'usuario@ejemplo.com',
  })
  email: string;

  @ApiProperty({
    description: 'Rol del usuario en la plataforma',
    example: 'ATHLETE',
  })
  role: string;
}

/**
 * DTO de respuesta para HU-004: POST /auth/login
 *
 * NUNCA expone el refreshToken hasheado ni el passwordHash.
 * El refreshToken que se retorna es el token opaco (sin hashear) — solo en esta respuesta.
 * El accessToken y el refreshToken NUNCA se loggean (Ley 1273/2009).
 */
export class AuthTokenResponseDto {
  @ApiProperty({
    description: 'JWT firmado para autenticar requests. NUNCA se loggea.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description:
      'Token opaco para renovar el accessToken. Se almacena hasheado en la BD. NUNCA se loggea.',
    example: 'rt_a1b2c3d4e5f6...',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Tiempo de expiracion del accessToken en segundos',
    example: 3600,
  })
  expiresIn: number;

  @ApiProperty({
    description: 'Datos del usuario autenticado',
    type: AuthUserDto,
  })
  user: AuthUserDto;
}
