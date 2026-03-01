import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO de entrada para HU-004: POST /auth/login
 *
 * Usado por Passport LocalStrategy para autenticar usuario por email + password.
 * El password NUNCA se loggea (Ley 1273/2009).
 */
export class LoginDto {
  @ApiProperty({
    description: 'Correo electronico del usuario',
    example: 'usuario@ejemplo.com',
  })
  @IsEmail({}, { message: 'El correo electronico no tiene un formato valido' })
  @IsNotEmpty({ message: 'El correo electronico es obligatorio' })
  email: string;

  @ApiProperty({
    description: 'Contrasena del usuario. NUNCA se loggea.',
    example: 'MiContrasena2026!',
  })
  @IsString({ message: 'La contrasena debe ser texto' })
  @IsNotEmpty({ message: 'La contrasena es obligatoria' })
  password: string;
}
