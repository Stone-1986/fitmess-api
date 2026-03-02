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
 * DTO de entrada para el registro de un atleta en Fase 1 (HU-003).
 *
 * El registro es atómico: User + LegalAcceptance(HABEAS_DATA)
 * + LegalAcceptance(TERMS_OF_SERVICE) se crean en una $transaction de Prisma.
 *
 * IMPORTANTE: HEALTH_DATA_CONSENT no se solicita en Fase 1. Se difiere a la
 * inscripción al plan (EPICA-04), en cumplimiento de Ley 1581/2012 art. 6
 * y Decreto 1377/2013 (principio de finalidad y minimalidad).
 *
 * Aceptaciones legales requeridas independientemente (Ley 1581/2012, Decreto 1377/2013):
 * - acceptsHabeasData: checkbox independiente obligatorio
 * - acceptsTermsOfService: checkbox independiente obligatorio
 */
export class RegisterAthleteDto {
  // ── Datos personales (persisten en User) ───────────────────────────────────

  @ApiProperty({
    description: 'Nombre completo del atleta',
    example: 'Laura Valentina Torres Medina',
    minLength: 2,
    maxLength: 120,
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(120, { message: 'El nombre no puede superar 120 caracteres' })
  name: string;

  @ApiProperty({
    description: 'Correo electrónico del atleta. Debe ser único en la plataforma.',
    example: 'laura.torres@ejemplo.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  email: string;

  @ApiProperty({
    description:
      'Contraseña del atleta. Mínimo 8 caracteres, debe incluir al menos una letra y un número.',
    example: 'MiClaveSegura456',
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
    description: 'Número de teléfono del atleta (sin código de país)',
    example: '3209876543',
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
    example: '1010203040',
    maxLength: 30,
  })
  @IsString()
  @IsNotEmpty({ message: 'El número de identificación es obligatorio' })
  @MaxLength(30, { message: 'El número de identificación no puede superar 30 caracteres' })
  identificationNumber: string;

  @ApiPropertyOptional({
    description: 'Fecha de nacimiento del atleta en formato ISO 8601',
    example: '1998-11-22',
    format: 'date',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de nacimiento debe estar en formato ISO 8601 (YYYY-MM-DD)' })
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description: 'URL de la foto de perfil del atleta (subida previamente al storage externo)',
    example: 'https://storage.fitmess.co/avatars/laura-torres.jpg',
    format: 'uri',
  })
  @IsOptional()
  @IsUrl({}, { message: 'La URL del avatar no tiene un formato válido' })
  avatarUrl?: string;

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
      'Autorización para el tratamiento de datos personales conforme a la política de habeas data. Checkbox obligatorio e independiente del consentimiento de términos. (Ley 1581/2012 art. 9, Decreto 1377/2013)',
    example: true,
  })
  @IsBoolean({
    message: 'La autorización de habeas data debe ser verdadero o falso',
  })
  acceptsHabeasData: boolean;

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
