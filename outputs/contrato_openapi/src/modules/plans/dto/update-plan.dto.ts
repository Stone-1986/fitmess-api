import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * DTO de entrada para HU-008: Edicion de los datos generales de un plan.
 *
 * Los cuatro campos son opcionales (semantica PATCH). Este DTO valida
 * estructura unicamente — la regla de negocio de D-6 (startDate/endDate
 * solo editables si el plan sigue en Borrador; rechazo con PLAN_IMMUTABLE
 * si no) vive en el service, no aqui: el DTO no conoce el estado del plan.
 *
 * name/description son editables en CUALQUIER estado (D-6) — RN-31 solo
 * inmoviliza fechas y estructura de fases/semanas al publicar, nunca
 * name/description.
 */
export class UpdatePlanDto {
  @ApiPropertyOptional({
    description: 'Nuevo nombre del plan. Editable en cualquier estado (D-6).',
    example: 'Fuerza e hipertrofia — bloque 1 (revisado)',
    minLength: 2,
    maxLength: 150,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre del plan no puede estar vacio' })
  @MaxLength(150, { message: 'El nombre no puede superar 150 caracteres' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Nueva descripcion del plan. Editable en cualquier estado (D-6).',
    example:
      'Bloque de 8 semanas enfocado en fuerza maxima y volumen de hipertrofia para tren inferior, con enfasis en tecnica de sentadilla.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'La descripcion no puede superar 1000 caracteres' })
  description?: string;

  @ApiPropertyOptional({
    description:
      'Nueva fecha de inicio (YYYY-MM-DD). Solo se acepta si el plan sigue en ' +
      'Borrador — RN-31 la inmoviliza al publicar. Si se envia con el plan ya ' +
      'publicado, el service rechaza con PLAN_IMMUTABLE (409).',
    example: '2026-09-08',
    format: 'date',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de inicio debe tener un formato de fecha valido (YYYY-MM-DD)' })
  startDate?: string;

  @ApiPropertyOptional({
    description:
      'Nueva fecha de fin (YYYY-MM-DD). Solo se acepta si el plan sigue en ' +
      'Borrador — RN-31 la inmoviliza al publicar. Si se envia con el plan ya ' +
      'publicado, el service rechaza con PLAN_IMMUTABLE (409).',
    example: '2026-11-03',
    format: 'date',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de fin debe tener un formato de fecha valido (YYYY-MM-DD)' })
  endDate?: string;
}
