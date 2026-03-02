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
import { IdentificationType } from '../enums/identification-type.enum.js';

/**
 * DTO de entrada para HU-003: Registro inicial del atleta.
 *
 * Guardrails legales:
 * - Ley 1581/2012 + Decreto 1377/2013: HABEAS_DATA y TERMS_OF_SERVICE como
 *   checkboxes separados e independientes. Ambos obligatorios.
 * - HEALTH_DATA_CONSENT NO aplica en Fase 1. Se difiere a EPICA-04 (HU-014)
 *   cuando el atleta se inscribe a un plan y comienza a registrar datos de salud.
 * - Ley 527/1999: aceptaciones registradas de forma inmutable en legal_acceptances.
 * - Ley 1273/2009: password nunca en logs; mensaje neutro ante duplicados (anti-enumeracion).
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
    description: 'Correo electronico del atleta. Unico en la plataforma.',
    example: 'laura.torres@ejemplo.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'El correo electronico no tiene un formato valido' })
  @IsNotEmpty({ message: 'El correo electronico es obligatorio' })
  email: string;

  @ApiProperty({
    description:
      'Contrasena del atleta. Minimo 8 caracteres, debe incluir al menos una letra y un numero.',
    example: 'MiClaveSegura456',
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
    description: 'Numero de telefono del atleta (sin codigo de pais)',
    example: '3209876543',
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
    example: '1010203040',
    maxLength: 30,
  })
  @IsString()
  @IsNotEmpty({ message: 'El numero de identificacion es obligatorio' })
  @MaxLength(30, {
    message: 'El numero de identificacion no puede superar 30 caracteres',
  })
  identificationNumber: string;

  @ApiPropertyOptional({
    description: 'Fecha de nacimiento del atleta en formato ISO 8601',
    example: '1998-11-22',
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
      'URL de la foto de perfil del atleta (subida previamente al storage externo)',
    example: 'https://storage.fitmess.co/avatars/laura-torres.jpg',
    format: 'uri',
  })
  @IsOptional()
  @IsUrl({}, { message: 'La URL del avatar no tiene un formato valido' })
  avatarUrl?: string;

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
      'Autorizacion para el tratamiento de datos personales conforme a la politica de habeas data. Checkbox obligatorio e independiente del consentimiento de terminos. (Ley 1581/2012 art. 9, Decreto 1377/2013)',
    example: true,
  })
  @IsBoolean({
    message: 'La autorizacion de habeas data debe ser verdadero o falso',
  })
  acceptsHabeasData: boolean;

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
