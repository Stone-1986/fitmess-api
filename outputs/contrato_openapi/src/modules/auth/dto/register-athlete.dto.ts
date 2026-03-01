import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTrue,
  IsUrl,
  MinLength,
} from 'class-validator';
import { IdentificationType } from '../enums/identification-type.enum';

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
    example: 'Maria Fernanda Lopez',
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name: string;

  @ApiProperty({
    description: 'Correo electronico del atleta. Unico en la plataforma.',
    example: 'atleta@ejemplo.com',
  })
  @IsEmail({}, { message: 'El correo electronico no tiene un formato valido' })
  @IsNotEmpty({ message: 'El correo electronico es obligatorio' })
  email: string;

  @ApiProperty({
    description: 'Contrasena del atleta. Minimo 8 caracteres. Se almacena cifrada con bcrypt (>=10 rondas).',
    example: 'MiContrasena2026!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres' })
  password: string;

  @ApiProperty({
    description: 'Indicativo internacional del pais del numero de telefono',
    example: '+57',
  })
  @IsString()
  @IsNotEmpty({ message: 'El indicativo de pais es obligatorio' })
  phoneCountryCode: string;

  @ApiProperty({
    description: 'Numero de telefono del atleta (sin indicativo de pais)',
    example: '3107654321',
  })
  @IsString()
  @IsNotEmpty({ message: 'El numero de telefono es obligatorio' })
  phone: string;

  @ApiProperty({
    description: 'Tipo de documento de identificacion',
    enum: IdentificationType,
    example: IdentificationType.CC,
  })
  @IsEnum(IdentificationType, {
    message: 'El tipo de identificacion debe ser uno de: CC, CE, NIT, PASAPORTE, PPT, PEP',
  })
  identificationType: IdentificationType;

  @ApiProperty({
    description: 'Numero de documento de identificacion. Unico en la plataforma.',
    example: '1098765432',
  })
  @IsString()
  @IsNotEmpty({ message: 'El numero de identificacion es obligatorio' })
  identificationNumber: string;

  @ApiProperty({
    description: 'Fecha de nacimiento del atleta. Formato ISO 8601.',
    example: '1995-06-15',
  })
  @IsDateString({}, { message: 'La fecha de nacimiento debe estar en formato ISO 8601 (YYYY-MM-DD)' })
  dateOfBirth: string;

  @ApiPropertyOptional({
    description: 'URL del avatar del atleta. El cliente gestiona el upload externo.',
    example: 'https://storage.ejemplo.com/avatars/atleta-001.jpg',
  })
  @IsOptional()
  @IsUrl({}, { message: 'El avatarUrl debe ser una URL valida' })
  avatarUrl?: string;

  // ── Consentimientos legales ────────────────────────────────────────────────

  @ApiProperty({
    description:
      'Aceptacion de la Politica de Tratamiento de Datos Personales (HABEAS_DATA). ' +
      'Documento independiente de los terminos. Obligatorio bajo Ley 1581/2012 y Decreto 1377/2013. ' +
      'Se registra de forma inmutable en legal_acceptances con timestamp y version del documento.',
    example: true,
  })
  @IsBoolean({ message: 'La autorizacion de tratamiento de datos personales es obligatoria' })
  @IsTrue({
    message:
      'Debes aceptar la Politica de Tratamiento de Datos Personales (habeas data) para continuar (Ley 1581/2012)',
  })
  acceptedPersonalDataPolicy: boolean;

  @ApiProperty({
    description:
      'Aceptacion de los Terminos y Condiciones de la plataforma (TERMS_OF_SERVICE). ' +
      'Obligatorio. Se registra de forma inmutable en legal_acceptances con timestamp y version del documento (Ley 527/1999).',
    example: true,
  })
  @IsBoolean({ message: 'La aceptacion de los terminos es obligatoria' })
  @IsTrue({ message: 'Debes aceptar los Terminos y Condiciones para continuar' })
  acceptedTermsOfService: boolean;

  @ApiProperty({
    description:
      'Version del documento de Politica de Tratamiento de Datos aceptado. ' +
      'Se persiste en legal_acceptances para trazabilidad (Ley 527/1999).',
    example: 'v1.3',
  })
  @IsString()
  @IsNotEmpty({ message: 'La version del documento de datos personales es obligatoria' })
  personalDataDocumentVersion: string;

  @ApiProperty({
    description:
      'Version del documento de Terminos y Condiciones aceptado. ' +
      'Se persiste en legal_acceptances para trazabilidad (Ley 527/1999).',
    example: 'v2.1',
  })
  @IsString()
  @IsNotEmpty({ message: 'La version del documento de terminos es obligatoria' })
  termsDocumentVersion: string;
}
