import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CoachRequestStatus } from '../../../../../generated/prisma/index.js';
import { IsOnOrAfter } from '../validators/is-on-or-after.validator.js';

/**
 * Formato de fecha aceptado en los filtros de rango: solo la parte de fecha.
 *
 * Se restringe a YYYY-MM-DD (y no a ISO 8601 completo) porque el service compone
 * la hora y el offset de Colombia sobre este valor. Aceptar un datetime completo
 * produciria una fecha invalida al concatenar.
 */
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * DTO de entrada para HU-002: Busqueda avanzada de solicitudes de entrenadores.
 *
 * Todos los filtros son opcionales. Body vacio {} retorna todas las solicitudes
 * con paginacion por defecto (page=1, limit=20).
 *
 * Filtros combinables con logica AND.
 * Los campos ids y status aceptan arrays para filtrar multiples valores.
 * createdAtFrom y createdAtTo delimitan un rango de fechas; cada extremo es
 * opcional por separado.
 */
export class SearchCoachRequestsDto {
  // ── Filtros ────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description: 'Lista de UUIDs de solicitudes a buscar',
    type: [String],
    example: [
      '550e8400-e29b-41d4-a716-446655440000',
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    ],
  })
  @IsOptional()
  @IsArray({ message: 'Los IDs deben ser un arreglo' })
  @IsUUID('4', { each: true, message: 'Cada ID debe ser un UUID v4 valido' })
  ids?: string[];

  @ApiPropertyOptional({
    description:
      'Filtrar por estado(s) de la solicitud. Multiples valores = OR entre estados.',
    enum: CoachRequestStatus,
    isArray: true,
    example: [CoachRequestStatus.PENDING],
  })
  @IsOptional()
  @IsArray({ message: 'Los estados deben ser un arreglo' })
  @IsEnum(CoachRequestStatus, {
    each: true,
    message: `Cada estado debe ser uno de: ${Object.values(CoachRequestStatus).join(', ')}`,
  })
  status?: CoachRequestStatus[];

  @ApiPropertyOptional({
    description: 'Filtrar por correo electronico exacto del coach solicitante',
    example: 'carlos.gomez@ejemplo.com',
    format: 'email',
  })
  @IsOptional()
  @IsEmail({}, { message: 'El correo electronico no tiene un formato valido' })
  email?: string;

  @ApiPropertyOptional({
    description:
      'Filtrar por nombre parcial del coach solicitante (busqueda ILIKE)',
    example: 'Carlos',
    maxLength: 120,
  })
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MaxLength(120, { message: 'El nombre no puede superar 120 caracteres' })
  name?: string;

  @ApiPropertyOptional({
    description:
      'Filtrar por numero de identificacion exacto del coach solicitante',
    example: '1020304050',
    maxLength: 30,
  })
  @IsOptional()
  @IsString({
    message: 'El numero de identificacion debe ser una cadena de texto',
  })
  @MaxLength(30, {
    message: 'El numero de identificacion no puede superar 30 caracteres',
  })
  identificationNumber?: string;

  @ApiPropertyOptional({
    description:
      'Fecha inicial del rango de creacion (inclusive, desde las 00:00:00 de ese dia). ' +
      'Formato YYYY-MM-DD, interpretada en hora local de Colombia (UTC-5). ' +
      'Si se omite, no hay limite inferior.',
    example: '2026-03-01',
    format: 'date',
  })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, {
    message: 'createdAtFrom debe tener el formato YYYY-MM-DD',
  })
  @IsDateString(
    { strict: true },
    {
      message: 'createdAtFrom no corresponde a una fecha valida del calendario',
    },
  )
  createdAtFrom?: string;

  @ApiPropertyOptional({
    description:
      'Fecha final del rango de creacion (inclusive, hasta las 23:59:59.999 de ese dia). ' +
      'Formato YYYY-MM-DD, interpretada en hora local de Colombia (UTC-5). ' +
      'Si se omite, no hay limite superior. Para buscar un solo dia, enviar el mismo ' +
      'valor en createdAtFrom y createdAtTo.',
    example: '2026-03-31',
    format: 'date',
  })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, {
    message: 'createdAtTo debe tener el formato YYYY-MM-DD',
  })
  @IsDateString(
    { strict: true },
    { message: 'createdAtTo no corresponde a una fecha valida del calendario' },
  )
  @IsOnOrAfter('createdAtFrom', {
    message: 'createdAtTo no puede ser anterior a createdAtFrom',
  })
  createdAtTo?: string;

  // ── Paginacion ─────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description: 'Numero de pagina (base 1)',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La pagina debe ser un numero entero' })
  @Min(1, { message: 'La pagina minima es 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de resultados por pagina',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El limite debe ser un numero entero' })
  @Min(1, { message: 'El limite minimo es 1' })
  @Max(100, { message: 'El limite maximo es 100' })
  limit?: number = 20;
}
