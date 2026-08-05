import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CoachRequestStatus } from '../enums/coach-request-status.enum';
import { IsOnOrAfter } from '../validators/is-on-or-after.validator';

/**
 * DTO de entrada para HU-002: Busqueda avanzada de solicitudes de entrenadores.
 *
 * Todos los filtros son opcionales. Body vacio {} retorna todas las solicitudes
 * con paginacion por defecto (page=1, limit=10).
 *
 * Filtros combinables con logica AND.
 * Los campos uuid y status aceptan arrays para filtrar multiples valores.
 */
export class SearchCoachRequestsDto {
  @ApiPropertyOptional({
    description: 'Lista de UUIDs de solicitudes a buscar. Filtrado por inclusion (OR entre los UUIDs del array).',
    type: [String],
    example: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'b2c3d4e5-f6a7-8901-bcde-f12345678901'],
  })
  @IsOptional()
  @IsArray({ message: 'uuid debe ser un array de UUIDs' })
  @IsUUID('4', { each: true, message: 'Cada elemento de uuid debe ser un UUID v4 valido' })
  uuid?: string[];

  @ApiPropertyOptional({
    description: 'Lista de estados a filtrar. Filtrado por inclusion (OR entre los estados del array).',
    type: [String],
    enum: CoachRequestStatus,
    isArray: true,
    example: [CoachRequestStatus.PENDING],
  })
  @IsOptional()
  @IsArray({ message: 'status debe ser un array de estados validos' })
  @IsEnum(CoachRequestStatus, {
    each: true,
    message: 'Cada elemento de status debe ser uno de: PENDING, APPROVED, REJECTED',
  })
  status?: CoachRequestStatus[];

  @ApiPropertyOptional({
    description: 'Filtrar por correo electronico del solicitante (coincidencia exacta)',
    example: 'coach@ejemplo.com',
  })
  @IsOptional()
  @IsString({ message: 'mail debe ser una cadena de texto' })
  mail?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por nombre del solicitante (busqueda parcial, ILIKE %valor%)',
    example: 'Carlos',
  })
  @IsOptional()
  @IsString({ message: 'nombre debe ser una cadena de texto' })
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por numero de identificacion del solicitante (coincidencia exacta)',
    example: '1023456789',
  })
  @IsOptional()
  @IsString({ message: 'identificationNumber debe ser una cadena de texto' })
  identificationNumber?: string;

  @ApiPropertyOptional({
    description: 'Fecha inicial del rango de creacion (inclusive). Formato YYYY-MM-DD, interpretada en hora local de Colombia (UTC-5). Si se omite, no hay limite inferior.',
    example: '2026-03-01',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'createdAtFrom debe tener el formato YYYY-MM-DD' })
  @IsDateString({ strict: true }, { message: 'createdAtFrom no corresponde a una fecha valida del calendario' })
  createdAtFrom?: string;

  @ApiPropertyOptional({
    description: 'Fecha final del rango de creacion (inclusive, cubre el dia completo). Formato YYYY-MM-DD, interpretada en hora local de Colombia (UTC-5). Para buscar un solo dia, enviar el mismo valor en createdAtFrom y createdAtTo.',
    example: '2026-03-31',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'createdAtTo debe tener el formato YYYY-MM-DD' })
  @IsDateString({ strict: true }, { message: 'createdAtTo no corresponde a una fecha valida del calendario' })
  @IsOnOrAfter('createdAtFrom', { message: 'createdAtTo no puede ser anterior a createdAtFrom' })
  createdAtTo?: string;

  @ApiPropertyOptional({
    description: 'Numero de pagina (empieza en 1)',
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page debe ser un numero entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de resultados por pagina (maximo 100)',
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un numero entero' })
  @Min(1, { message: 'limit debe ser mayor o igual a 1' })
  @Max(100, { message: 'limit no puede superar 100' })
  limit?: number = 10;
}
