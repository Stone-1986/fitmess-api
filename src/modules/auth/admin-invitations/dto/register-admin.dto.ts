import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IdentificationType } from '../../../../../generated/prisma/index.js';

/**
 * DTO de entrada para HU-003: POST /auth/admin/register
 *
 * Registra un nuevo administrador usando un token de invitacion valido.
 * Replica los campos de datos personales de RegisterAthleteDto (decision arquitectonica:
 * no se reutiliza el DTO para evitar acoplamiento de contratos).
 * Agrega el campo invitationToken (campo adicional especifico de este endpoint).
 *
 * Guardrails legales:
 * - Ley 1581/2012 + Decreto 1377/2013: acceptsHabeasData y acceptsTermsOfService
 *   son checkboxes separados e independientes. Ambos obligatorios.
 * - Ley 527/1999: aceptaciones registradas de forma inmutable en legal_acceptances.
 * - Ley 1273/2009: password nunca en logs; invitationToken nunca en logs.
 *   El token va en body (no en path/header) para evitar que aparezca en access logs
 *   del servidor (nginx, load balancers, etc.).
 *
 * RIESGO MEDIUM (plan EPICA-09): Los campos legales son OBLIGATORIOS.
 * El frontend NO debe asumir que los admins omiten las aceptaciones legales.
 * La $transaction rechaza si los campos legales no se registran.
 */
export class RegisterAdminDto {
  // ── Token de invitacion ─────────────────────────────────────────────────────

  @ApiProperty({
    description:
      'Token de invitacion recibido por correo electronico. ' +
      'Debe ser valido, no expirado y no utilizado previamente. ' +
      'El service hashea este token con sha256 para buscar en base de datos. ' +
      'NUNCA se loggea — Ley 1273/2009.',
    example: 'a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1',
    minLength: 64,
    maxLength: 64,
  })
  @IsString()
  @IsNotEmpty({ message: 'El token de invitacion es obligatorio' })
  @MinLength(64, {
    message: 'El token de invitacion no tiene el formato esperado',
  })
  @MaxLength(64, {
    message: 'El token de invitacion no tiene el formato esperado',
  })
  invitationToken: string;

  // ── Datos personales (persisten en User) ───────────────────────────────────

  @ApiProperty({
    description: 'Nombre completo del administrador',
    example: 'Carlos Andres Ramirez Ospina',
    minLength: 2,
    maxLength: 120,
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(120, { message: 'El nombre no puede superar 120 caracteres' })
  name: string;

  @ApiProperty({
    description:
      'Correo electronico del administrador. Debe coincidir con el email de la invitacion. ' +
      'Unico en la plataforma.',
    example: 'carlos.ramirez@fitmess.co',
    format: 'email',
  })
  @IsEmail({}, { message: 'El correo electronico no tiene un formato valido' })
  @IsNotEmpty({ message: 'El correo electronico es obligatorio' })
  email: string;

  @ApiProperty({
    description:
      'Contrasena del administrador. Minimo 8 caracteres, debe incluir al menos una letra y un numero. ' +
      'NUNCA se loggea — Ley 1273/2009.',
    example: 'MiClaveAdmin789',
    minLength: 8,
    maxLength: 72,
    format: 'password',
  })
  @IsString()
  @IsNotEmpty({ message: 'La contrasena es obligatoria' })
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contrasena no puede superar 72 caracteres' })
  @Matches(/(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'La contrasena debe contener al menos una letra y un numero',
  })
  password: string;

  @ApiProperty({
    description: 'Numero de telefono del administrador (sin codigo de pais)',
    example: '3001234567',
    maxLength: 15,
  })
  @IsString()
  @IsNotEmpty({ message: 'El telefono es obligatorio' })
  @MaxLength(15, { message: 'El telefono no puede superar 15 caracteres' })
  phone: string;

  @ApiProperty({
    description: 'Codigo de pais del telefono en formato E.164 (sin el +)',
    example: '57',
    maxLength: 5,
  })
  @IsString()
  @IsNotEmpty({ message: 'El codigo de pais del telefono es obligatorio' })
  @MaxLength(5, { message: 'El codigo de pais no puede superar 5 caracteres' })
  phoneCountryCode: string;

  @ApiProperty({
    description: 'Tipo de documento de identificacion',
    enum: IdentificationType,
    example: IdentificationType.CC,
  })
  @IsEnum(IdentificationType, {
    message: `El tipo de identificacion debe ser uno de: ${Object.values(IdentificationType).join(', ')}`,
  })
  identificationType: IdentificationType;

  @ApiProperty({
    description:
      'Numero de documento de identificacion. Debe ser unico en la plataforma.',
    example: '80123456',
    maxLength: 30,
  })
  @IsString()
  @IsNotEmpty({ message: 'El numero de identificacion es obligatorio' })
  @MaxLength(30, {
    message: 'El numero de identificacion no puede superar 30 caracteres',
  })
  identificationNumber: string;

  @ApiPropertyOptional({
    description: 'Fecha de nacimiento del administrador en formato ISO 8601',
    example: '1985-06-15',
    format: 'date',
  })
  @IsOptional()
  @IsDateString(
    {},
    {
      message:
        'La fecha de nacimiento debe estar en formato ISO 8601 (YYYY-MM-DD)',
    },
  )
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description:
      'URL de la foto de perfil del administrador (subida previamente al storage externo)',
    example: 'https://storage.fitmess.co/avatars/carlos-ramirez.jpg',
    format: 'uri',
  })
  @IsOptional()
  @IsUrl({}, { message: 'La URL del avatar no tiene un formato valido' })
  avatarUrl?: string;

  // ── Aceptaciones legales OBLIGATORIAS (Ley 1581/2012, Decreto 1377/2013) ───
  // IMPORTANTE: estos campos son REQUERIDOS para cuentas de administrador tambien.
  // El administrador que acepta los terminos lo hace de forma expresa mediante la
  // accion afirmativa de completar el formulario de registro (no pre-marcado).

  @ApiProperty({
    description:
      'Aceptacion de los Terminos y Condiciones de uso de la plataforma. ' +
      'Checkbox OBLIGATORIO e independiente. Debe ser true para completar el registro. ' +
      'Ley 527/1999: registrado como documento digital inmutable en legal_acceptances.',
    example: true,
  })
  @IsBoolean({
    message:
      'La aceptacion de los terminos y condiciones debe ser verdadero o falso',
  })
  acceptsTermsOfService: boolean;

  @ApiProperty({
    description:
      'Version del documento de Terminos y Condiciones aceptado. ' +
      'Permite trazabilidad de que version acepto el administrador. Ley 527/1999.',
    example: 'v1.0',
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty({
    message: 'La version del documento de terminos es obligatoria',
  })
  @MaxLength(20, {
    message:
      'La version del documento de terminos no puede superar 20 caracteres',
  })
  termsDocumentVersion: string;

  @ApiProperty({
    description:
      'Autorizacion para el tratamiento de datos personales conforme a la politica de habeas data. ' +
      'Checkbox OBLIGATORIO e independiente del consentimiento de terminos. ' +
      'Ley 1581/2012 art. 9, Decreto 1377/2013. Debe ser true para completar el registro.',
    example: true,
  })
  @IsBoolean({
    message: 'La autorizacion de habeas data debe ser verdadero o falso',
  })
  acceptsHabeasData: boolean;

  @ApiProperty({
    description:
      'Version del documento de autorizacion de tratamiento de datos personales (habeas data) aceptado. ' +
      'Permite trazabilidad de que version acepto el administrador. Ley 527/1999.',
    example: 'v1.0',
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty({
    message: 'La version del documento de habeas data es obligatoria',
  })
  @MaxLength(20, {
    message:
      'La version del documento de habeas data no puede superar 20 caracteres',
  })
  personalDataDocumentVersion: string;
}
