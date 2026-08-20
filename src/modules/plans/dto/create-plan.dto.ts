import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * DTO de entrada para HU-008: Creacion del shell de un plan de entrenamiento.
 *
 * Solo `name` es obligatorio (decision D-3 del plan de implementacion).
 * description, startDate y endDate son opcionales al crear — RN-01 (plan
 * completo) y RN-02 (fecha de fin obligatoria) se validan integramente en
 * publish() (HU-009), nunca aqui: CA-008-2 permite guardar un plan
 * incompleto o sin fechas indefinidamente en Borrador.
 *
 * El plan se crea siempre en estado Borrador, sin ninguna fase todavia
 * (CA-008-1) — status no es un campo de este DTO, lo fija el service.
 */
export class CreatePlanDto {
  @ApiProperty({
    description: 'Nombre del plan de entrenamiento',
    example: 'Fuerza e hipertrofia — bloque 1',
    minLength: 2,
    maxLength: 150,
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre del plan es obligatorio' })
  @MaxLength(150, { message: 'El nombre no puede superar 150 caracteres' })
  name: string;

  @ApiPropertyOptional({
    description:
      'Descripcion del plan visible para el atleta en el catalogo (HU-011). ' +
      'Opcional al crear — se puede completar despues, incluso tras publicar (D-6).',
    example:
      'Bloque de 8 semanas enfocado en fuerza maxima y volumen de hipertrofia para tren inferior.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, {
    message: 'La descripcion no puede superar 1000 caracteres',
  })
  description?: string;

  @ApiPropertyOptional({
    description:
      'Fecha de inicio del plan (YYYY-MM-DD). Opcional al crear — RN-02 solo la ' +
      'exige para PUBLICAR, nunca para guardar en Borrador (CA-008-2).',
    example: '2026-09-01',
    format: 'date',
  })
  @IsOptional()
  @IsDateString(
    {},
    {
      message:
        'La fecha de inicio debe tener un formato de fecha valido (YYYY-MM-DD)',
    },
  )
  startDate?: string;

  @ApiPropertyOptional({
    description:
      'Fecha de fin del plan (YYYY-MM-DD). Opcional al crear, obligatoria para ' +
      'publicar (RN-02) — no existen planes open-ended.',
    example: '2026-10-27',
    format: 'date',
  })
  @IsOptional()
  @IsDateString(
    {},
    {
      message:
        'La fecha de fin debe tener un formato de fecha valido (YYYY-MM-DD)',
    },
  )
  endDate?: string;
}
