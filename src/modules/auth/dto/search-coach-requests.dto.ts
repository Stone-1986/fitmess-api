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
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CoachRequestStatus } from '../../../../generated/prisma/index.js';

/**
 * DTO de entrada para HU-002: Busqueda avanzada de solicitudes de entrenadores.
 *
 * Todos los filtros son opcionales. Body vacio {} retorna todas las solicitudes
 * con paginacion por defecto (page=1, limit=20).
 *
 * Filtros combinables con logica AND.
 * Los campos ids y status aceptan arrays para filtrar multiples valores.
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
      'Filtrar solicitudes creadas en una fecha especifica (formato ISO 8601, solo la parte de fecha)',
    example: '2026-03-01',
    format: 'date',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha debe estar en formato ISO 8601 (YYYY-MM-DD)' },
  )
  createdAt?: string;

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
