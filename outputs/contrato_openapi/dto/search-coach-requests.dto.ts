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
import { CoachRequestStatus } from '../enums/coach-request-status.enum';

/**
 * DTO de entrada para búsqueda de solicitudes de entrenadores (HU-002).
 *
 * Endpoint: POST /coach-requests/search
 * Acceso: exclusivo para ADMIN
 *
 * Todos los filtros son opcionales y combinables (AND lógico).
 * Body vacío retorna todas las solicitudes con paginación por defecto.
 * La búsqueda por nombre es parcial (ILIKE %valor%).
 */
export class SearchCoachRequestsDto {
  // ── Filtros ────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description: 'Lista de UUIDs de solicitudes a buscar',
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'],
  })
  @IsOptional()
  @IsArray({ message: 'Los IDs deben ser un arreglo' })
  @IsUUID('4', { each: true, message: 'Cada ID debe ser un UUID v4 válido' })
  ids?: string[];

  @ApiPropertyOptional({
    description: 'Filtrar por estado(s) de la solicitud. Múltiples valores = OR entre estados.',
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
    description: 'Filtrar por correo electrónico exacto del coach solicitante',
    example: 'carlos.gomez@ejemplo.com',
    format: 'email',
  })
  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por nombre parcial del coach solicitante (búsqueda ILIKE)',
    example: 'Carlos',
    maxLength: 120,
  })
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MaxLength(120, { message: 'El nombre no puede superar 120 caracteres' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por número de identificación exacto del coach solicitante',
    example: '1020304050',
    maxLength: 30,
  })
  @IsOptional()
  @IsString({ message: 'El número de identificación debe ser una cadena de texto' })
  @MaxLength(30, { message: 'El número de identificación no puede superar 30 caracteres' })
  identificationNumber?: string;

  @ApiPropertyOptional({
    description:
      'Filtrar solicitudes creadas en una fecha específica (formato ISO 8601, solo la parte de fecha)',
    example: '2026-03-01',
    format: 'date',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe estar en formato ISO 8601 (YYYY-MM-DD)' })
  createdAt?: string;

  // ── Paginación ─────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description: 'Número de página (base 1)',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página mínima es 1' })
  page?: number;

  @ApiPropertyOptional({
    description: 'Cantidad de resultados por página',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite mínimo es 1' })
  @Max(100, { message: 'El límite máximo es 100' })
  limit?: number;
}
