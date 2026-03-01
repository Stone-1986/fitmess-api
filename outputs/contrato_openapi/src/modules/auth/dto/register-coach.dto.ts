import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsTrue,
  MinLength,
} from 'class-validator';
import { IdentificationType } from '../enums/identification-type.enum';

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
    example: 'Carlos Andres Ramirez',
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name: string;

  @ApiProperty({
    description: 'Correo electronico del entrenador. Unico en la plataforma.',
    example: 'coach@ejemplo.com',
  })
  @IsEmail({}, { message: 'El correo electronico no tiene un formato valido' })
  @IsNotEmpty({ message: 'El correo electronico es obligatorio' })
  email: string;

  @ApiProperty({
    description: 'Contrasena del entrenador. Minimo 8 caracteres. Se almacena cifrada con bcrypt (>=10 rondas).',
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
    description: 'Numero de telefono del entrenador (sin indicativo de pais)',
    example: '3001234567',
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
    example: '1023456789',
  })
  @IsString()
  @IsNotEmpty({ message: 'El numero de identificacion es obligatorio' })
  identificationNumber: string;

  @ApiPropertyOptional({
    description: 'URL del avatar del entrenador. El cliente gestiona el upload externo.',
    example: 'https://storage.ejemplo.com/avatars/coach-001.jpg',
  })
  @IsOptional()
  @IsUrl({}, { message: 'El avatarUrl debe ser una URL valida' })
  avatarUrl?: string;

  // ── Datos de solicitud (persisten en CoachRequest) ─────────────────────────

  @ApiProperty({
    description: 'Descripcion del plan de trabajo y metodologia del entrenador',
    example: 'Especialista en fuerza y acondicionamiento con 5 anos de experiencia en powerlifting.',
  })
  @IsString()
  @IsNotEmpty({ message: 'La descripcion del plan de trabajo es obligatoria' })
  planDescription: string;

  @ApiPropertyOptional({
    description: 'URL del banner de perfil del entrenador. El cliente gestiona el upload externo.',
    example: 'https://storage.ejemplo.com/banners/coach-001-banner.jpg',
  })
  @IsOptional()
  @IsUrl({}, { message: 'El bannerUrl debe ser una URL valida' })
  bannerUrl?: string;

  // ── Consentimientos legales ────────────────────────────────────────────────

  @ApiProperty({
    description:
      'Aceptacion de los Terminos y Condiciones de la plataforma (TERMS_OF_SERVICE). ' +
      'Obligatorio. Se registra de forma inmutable en legal_acceptances con timestamp y version del documento (Ley 527/1999).',
    example: true,
  })
  @IsBoolean({ message: 'La aceptacion de los terminos es obligatoria' })
  @IsTrue({ message: 'Debes aceptar los Terminos y Condiciones para continuar' })
  acceptedTerms: boolean;

  @ApiProperty({
    description:
      'Aceptacion de la Politica de Tratamiento de Datos Personales (HABEAS_DATA). ' +
      'Documento independiente de los terminos. Obligatorio bajo Ley 1581/2012 y Decreto 1377/2013. ' +
      'Se registra de forma inmutable en legal_acceptances.',
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
      'Version del documento de Terminos y Condiciones aceptado. ' +
      'Se persiste en legal_acceptances para trazabilidad (Ley 527/1999).',
    example: 'v2.1',
  })
  @IsString()
  @IsNotEmpty({ message: 'La version del documento de terminos es obligatoria' })
  termsDocumentVersion: string;

  @ApiProperty({
    description:
      'Version del documento de Politica de Tratamiento de Datos aceptado. ' +
      'Se persiste en legal_acceptances para trazabilidad (Ley 527/1999).',
    example: 'v1.3',
  })
  @IsString()
  @IsNotEmpty({ message: 'La version del documento de datos personales es obligatoria' })
  personalDataDocumentVersion: string;
}
