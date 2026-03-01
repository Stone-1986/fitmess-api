import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { applyDecorators } from '@nestjs/common';
import { ApiResponse, ApiExtraModels, getSchemaPath } from '@nestjs/swagger';

/**
 * DTO de clase que representa RFC 9457 Problem Details para Swagger.
 *
 * NOTA: ProblemDetail en el código es una interfaz (sin decoradores), pero Swagger
 * necesita una clase con @ApiProperty para generar el schema correctamente.
 * Este DTO es exclusivo para la documentación Swagger — no se instancia en runtime.
 */
export class ProblemDetailDto {
  @ApiProperty({
    description:
      'URI que identifica el tipo de error. Apunta a la documentación del error.',
    example: 'https://api.fitmess.co/errors/INVALID_STATE_TRANSITION',
  })
  type!: string;

  @ApiProperty({
    description:
      'Resumen corto y estable del tipo de error. No cambia entre ocurrencias.',
    example: 'Transición de estado no permitida',
  })
  title!: string;

  @ApiProperty({
    description:
      'HTTP status code. Debe coincidir con el status real de la respuesta.',
    example: 409,
  })
  status!: number;

  @ApiProperty({
    description: 'Explicación específica de esta ocurrencia del error.',
    example: "No se puede transicionar Plan de 'ARCHIVED' a 'PUBLISHED'",
  })
  detail!: string;

  @ApiPropertyOptional({
    description: 'URI del request que causó el error.',
    example: '/api/plans/550e8400/publish',
  })
  instance?: string;

  @ApiProperty({
    description:
      'Código máquina UPPER_SNAKE_CASE. Usado por el frontend para lógica condicional.',
    example: 'INVALID_STATE_TRANSITION',
  })
  errorCode!: string;

  @ApiPropertyOptional({
    description:
      'UUID único del request para traza end-to-end. Viene del header x-correlation-id.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  correlationId?: string;

  @ApiProperty({
    description: 'Momento exacto del error en formato ISO 8601.',
    example: '2026-03-15T14:30:45.123Z',
  })
  timestamp!: string;

  @ApiPropertyOptional({
    description:
      'Datos adicionales específicos de esta ocurrencia útiles para debugging.',
    example: {
      entity: 'Plan',
      currentState: 'ARCHIVED',
      targetState: 'PUBLISHED',
    },
  })
  context?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Solo presente en errores de validación. Un objeto por cada campo inválido.',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        field: { type: 'string', example: 'endDate' },
        message: {
          type: 'string',
          example: 'La fecha fin debe ser posterior a la fecha inicio',
        },
      },
    },
  })
  errors?: { field: string; message: string }[];
}

/**
 * Decorador de conveniencia para documentar respuestas de error RFC 9457 en Swagger.
 *
 * Uso en controllers:
 * @ApiProblemResponse(409, 'Transición de estado inválida')
 */
export const ApiProblemResponse = (status: number, description: string) =>
  applyDecorators(
    ApiExtraModels(ProblemDetailDto),
    ApiResponse({
      status,
      description,
      content: {
        'application/problem+json': {
          schema: { $ref: getSchemaPath(ProblemDetailDto) },
        },
      },
    }),
  );
