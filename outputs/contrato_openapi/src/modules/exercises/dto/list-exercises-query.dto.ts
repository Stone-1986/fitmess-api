import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * DTO de query params para HU-005 (CA-005-3) + HU-007 (CA-007-2): GET /exercises.
 *
 * page/limit: mismos defaults que el resto del proyecto (page=1, limit=20, max 100).
 *
 * includeInactive: por defecto false — el listado solo muestra ejercicios ACTIVOS
 * (CA-007-2). En true, incluye tambien los inhabilitados (unica via de auditar
 * el catalogo completo en bloque, dado que esta epica no define reactivacion).
 *
 * includeInactive usa @Transform explicito (en vez de @Type(() => Boolean))
 * porque Boolean('false') === true en JavaScript — @Type con conversion
 * implicita interpretaria mal el string 'false' que llega en un query param.
 */
export class ListExercisesQueryDto {
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

  @ApiPropertyOptional({
    description:
      'Si es true, incluye tambien los ejercicios inhabilitados (isActive=false) en el ' +
      'listado. Por defecto (false) el catalogo solo muestra ejercicios activos (CA-007-2).',
    example: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return value;
  })
  @IsBoolean({ message: 'includeInactive debe ser verdadero o falso' })
  includeInactive?: boolean = false;
}
