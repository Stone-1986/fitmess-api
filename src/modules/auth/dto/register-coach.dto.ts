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
import { IdentificationType } from '../../../../generated/prisma/index.js';

/**
 * DTO de entrada para HU-001: Solicitud de registro como entrenador.
 *
 * Campos personales van en User (compartidos con atleta).
 * Campos de solicitud (planDescription, bannerUrl) van en CoachRequest.
 *
 * Guardrails legales:
 * - Ley 1581/2012 + Decreto 1377/2013: TERMS_OF_SERVICE y HABEAS_DATA son documentos
 *   independientes. Ambos obligatorios (checkbox separado).
 * - Ley 527/1999: aceptaciones registradas de forma inmutable en legal_acceptances.
 * - Ley 1273/2009: password nunca en logs; mensaje neutro ante email/identificationNumber duplicado.
 */
export class RegisterCoachDto {
  // ── Datos personales (persisten en User) ───────────────────────────────────

  @ApiProperty({
    description: 'Nombre completo del entrenador',
    example: 'Carlos Andres Gomez Ruiz',
    minLength: 2,
    maxLength: 120,
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(120, { message: 'El nombre no puede superar 120 caracteres' })
  name: string;

  @ApiProperty({
    description: 'Correo electronico del entrenador. Unico en la plataforma.',
    example: 'carlos.gomez@ejemplo.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'El correo electronico no tiene un formato valido' })
  @IsNotEmpty({ message: 'El correo electronico es obligatorio' })
  email: string;

  @ApiProperty({
    description:
      'Contrasena del entrenador. Minimo 8 caracteres, debe incluir al menos una letra y un numero.',
    example: 'MiClaveSegura123',
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
    description: 'Numero de telefono del entrenador (sin codigo de pais)',
    example: '3101234567',
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
    example: '1020304050',
    maxLength: 30,
  })
  @IsString()
  @IsNotEmpty({ message: 'El numero de identificacion es obligatorio' })
  @MaxLength(30, {
    message: 'El numero de identificacion no puede superar 30 caracteres',
  })
  identificationNumber: string;

  @ApiPropertyOptional({
    description: 'Fecha de nacimiento del entrenador en formato ISO 8601',
    example: '1990-06-15',
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
      'URL de la foto de perfil del entrenador (subida previamente al storage externo)',
    example: 'https://storage.fitmess.co/avatars/carlos-gomez.jpg',
    format: 'uri',
  })
  @IsOptional()
  @IsUrl({}, { message: 'La URL del avatar no tiene un formato valido' })
  avatarUrl?: string;

  // ── Datos de solicitud (persisten en CoachRequest) ─────────────────────────

  @ApiProperty({
    description:
      'Descripcion del plan de entrenamiento que el entrenador ofrece. Texto libre que el administrador revisara.',
    example:
      'Entrenador certificado NSCA con 5 anos de experiencia en fuerza y acondicionamiento. Especializado en atletas de alto rendimiento.',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty({
    message: 'La descripcion del plan de entrenamiento es obligatoria',
  })
  @MaxLength(2000, {
    message: 'La descripcion no puede superar 2000 caracteres',
  })
  planDescription: string;

  @ApiPropertyOptional({
    description:
      'URL del banner o portafolio del entrenador (subida previamente al storage externo)',
    example: 'https://storage.fitmess.co/banners/carlos-gomez-banner.jpg',
    format: 'uri',
  })
  @IsOptional()
  @IsUrl({}, { message: 'La URL del banner no tiene un formato valido' })
  bannerUrl?: string;

  // ── Aceptaciones legales (Ley 1581/2012, Decreto 1377/2013) ───────────────

  @ApiProperty({
    description:
      'Aceptacion de los Terminos y Condiciones de uso de la plataforma. Checkbox obligatorio e independiente. (Ley 527/1999)',
    example: true,
  })
  @IsBoolean({
    message:
      'La aceptacion de los terminos y condiciones debe ser verdadero o falso',
  })
  acceptsTermsOfService: boolean;

  @ApiProperty({
    description:
      'Autorizacion para el tratamiento de datos personales conforme a la politica de habeas data. Checkbox obligatorio e independiente del consentimiento de terminos. (Ley 1581/2012 art. 9, Decreto 1377/2013)',
    example: true,
  })
  @IsBoolean({
    message: 'La autorizacion de habeas data debe ser verdadero o falso',
  })
  acceptsHabeasData: boolean;

  @ApiProperty({
    description:
      'Version del documento de Terminos y Condiciones aceptado. Permite trazabilidad de que version acepto el usuario. (Ley 527/1999)',
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
      'Version del documento de autorizacion de tratamiento de datos personales (habeas data) aceptado. Permite trazabilidad de que version acepto el usuario. (Ley 527/1999)',
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
