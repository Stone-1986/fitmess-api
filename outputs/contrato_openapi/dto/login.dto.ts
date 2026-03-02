import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * DTO de entrada para el inicio de sesión (HU-004).
 *
 * Procesado por Passport LocalStrategy antes de llegar al controller.
 *
 * Comportamiento de seguridad documentado (Ley 1273/2009, OWASP 2025):
 * - Mensaje idéntico para email inexistente y contraseña incorrecta (anti-enumeración)
 * - Bloqueo temporal por cuenta: 5 intentos fallidos consecutivos → bloqueo 15 minutos
 * - El ThrottlerGuard global actúa como capa adicional de protección por IP
 */
export class LoginDto {
  @ApiProperty({
    description: 'Correo electrónico del usuario registrado en la plataforma',
    example: 'usuario@ejemplo.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  email: string;

  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'MiClaveSegura123',
    maxLength: 72,
    format: 'password',
  })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MaxLength(72, { message: 'La contraseña no puede superar 72 caracteres' })
  password: string;
}
