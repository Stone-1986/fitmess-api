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
import { IdentificationType } from '../enums/identification-type.enum';

/**
 * DTO de entrada para el registro de un entrenador (HU-001).
 *
 * El registro es atómico: User + CoachRequest + LegalAcceptance(HABEAS_DATA)
 * + LegalAcceptance(TERMS_OF_SERVICE) se crean en una $transaction de Prisma.
 *
 * Campos de aceptación legal requeridos por Ley 1581/2012 y Decreto 1377/2013:
 * - acceptsHabeasData: checkbox independiente obligatorio
 * - acceptsTermsOfService: checkbox independiente obligatorio
 */
export class RegisterCoachDto {
  // ── Datos personales (persisten en User) ───────────────────────────────────

  @ApiProperty({
    description: 'Nombre completo del entrenador',
    example: 'Carlos Andrés Gómez Ruiz',
    minLength: 2,
    maxLength: 120,
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(120, { message: 'El nombre no puede superar 120 caracteres' })
  name: string;

  @ApiProperty({
    description: 'Correo electrónico del entrenador. Debe ser único en la plataforma.',
    example: 'carlos.gomez@ejemplo.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  email: string;

  @ApiProperty({
    description:
      'Contraseña del entrenador. Mínimo 8 caracteres, debe incluir al menos una letra y un número.',
    example: 'MiClaveSegura123',
    minLength: 8,
    maxLength: 72,
    format: 'password',
  })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contraseña no puede superar 72 caracteres' })
  @Matches(/(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'La contraseña debe contener al menos una letra y un número',
  })
  password: string;

  @ApiProperty({
    description: 'Número de teléfono del entrenador (sin código de país)',
    example: '3101234567',
    maxLength: 15,
  })
  @IsString()
  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  @MaxLength(15, { message: 'El teléfono no puede superar 15 caracteres' })
  phone: string;

  @ApiProperty({
    description: 'Código de país del teléfono en formato E.164 (sin el +)',
    example: '57',
    maxLength: 5,
  })
  @IsString()
  @IsNotEmpty({ message: 'El código de país del teléfono es obligatorio' })
  @MaxLength(5, { message: 'El código de país no puede superar 5 caracteres' })
  phoneCountryCode: string;

  @ApiProperty({
    description: 'Tipo de documento de identificación',
    enum: IdentificationType,
    example: IdentificationType.CC,
  })
  @IsEnum(IdentificationType, {
    message: `El tipo de identificación debe ser uno de: ${Object.values(IdentificationType).join(', ')}`,
  })
  identificationType: IdentificationType;

  @ApiProperty({
    description:
      'Número de documento de identificación. Debe ser único en la plataforma.',
    example: '1020304050',
    maxLength: 30,
  })
  @IsString()
  @IsNotEmpty({ message: 'El número de identificación es obligatorio' })
  @MaxLength(30, { message: 'El número de identificación no puede superar 30 caracteres' })
  identificationNumber: string;

  @ApiPropertyOptional({
    description: 'Fecha de nacimiento del entrenador en formato ISO 8601',
    example: '1990-06-15',
    format: 'date',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de nacimiento debe estar en formato ISO 8601 (YYYY-MM-DD)' })
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description: 'URL de la foto de perfil del entrenador (subida previamente al storage externo)',
    example: 'https://storage.fitmess.co/avatars/carlos-gomez.jpg',
    format: 'uri',
  })
  @IsOptional()
  @IsUrl({}, { message: 'La URL del avatar no tiene un formato válido' })
  avatarUrl?: string;

  // ── Datos de la solicitud (persisten en CoachRequest) ──────────────────────

  @ApiProperty({
    description:
      'Descripción del plan de entrenamiento que el entrenador ofrece. Texto libre que el administrador revisará.',
    example:
      'Entrenador certificado NSCA con 5 años de experiencia en fuerza y acondicionamiento. Especializado en atletas de alto rendimiento.',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty({ message: 'La descripción del plan de entrenamiento es obligatoria' })
  @MaxLength(2000, { message: 'La descripción no puede superar 2000 caracteres' })
  planDescription: string;

  @ApiPropertyOptional({
    description: 'URL del banner o portafolio del entrenador (subida previamente al storage externo)',
    example: 'https://storage.fitmess.co/banners/carlos-gomez-banner.jpg',
    format: 'uri',
  })
  @IsOptional()
  @IsUrl({}, { message: 'La URL del banner no tiene un formato válido' })
  bannerUrl?: string;

  // ── Aceptaciones legales (Ley 1581/2012, Decreto 1377/2013) ───────────────

  @ApiProperty({
    description:
      'Aceptación de los Términos y Condiciones de uso de la plataforma. Checkbox obligatorio e independiente. (Ley 527/1999)',
    example: true,
  })
  @IsBoolean({
    message: 'La aceptación de los términos y condiciones debe ser verdadero o falso',
  })
  acceptsTermsOfService: boolean;

  @ApiProperty({
    description:
      'Autorización para el tratamiento de datos personales conforme a la política de habeas data. Checkbox obligatorio e independiente del consentimiento de términos. (Ley 1581/2012 art. 9, Decreto 1377/2013)',
    example: true,
  })
  @IsBoolean({
    message: 'La autorización de habeas data debe ser verdadero o falso',
  })
  acceptsHabeasData: boolean;

  @ApiProperty({
    description:
      'Versión del documento de Términos y Condiciones aceptado. Permite trazabilidad de qué versión aceptó el usuario. (Ley 527/1999)',
    example: 'v1.0',
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty({
    message: 'La versión del documento de términos es obligatoria',
  })
  @MaxLength(20, {
    message:
      'La versión del documento de términos no puede superar 20 caracteres',
  })
  termsDocumentVersion: string;

  @ApiProperty({
    description:
      'Versión del documento de autorización de tratamiento de datos personales (habeas data) aceptado. Permite trazabilidad de qué versión aceptó el usuario. (Ley 527/1999)',
    example: 'v1.0',
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty({
    message:
      'La versión del documento de habeas data es obligatoria',
  })
  @MaxLength(20, {
    message:
      'La versión del documento de habeas data no puede superar 20 caracteres',
  })
  personalDataDocumentVersion: string;
}
