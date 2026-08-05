import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO de metadatos de paginación incluido en respuestas de listado.
 *
 * El ResponseInterceptor envuelve el resultado en:
 * { success, statusCode, data: [...], meta: PaginationMetaResponseDto, timestamp }
 */
export class PaginationMetaResponseDto {
  @ApiProperty({
    description: 'Página actual (base 1)',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Cantidad de elementos por página',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Total de elementos que coinciden con los filtros',
    example: 47,
  })
  totalItems: number;

  @ApiProperty({
    description: 'Total de páginas disponibles',
    example: 3,
  })
  totalPages: number;

  @ApiProperty({
    description: 'Indica si existe una página siguiente',
    example: true,
  })
  hasNext: boolean;

  @ApiProperty({
    description: 'Indica si existe una página anterior',
    example: false,
  })
  hasPrevious: boolean;
}
