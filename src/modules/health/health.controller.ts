import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service.js';
import { ApiProblemResponse } from '../common/swagger/error-responses.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Endpoint publico, sin guards: lo consultan los probes de infraestructura.
   * Es la unica ruta que el AuditMiddleware NO registra — la golpean cada pocos
   * segundos y no toca ningun dato.
   */
  // El orden importa: los decoradores se aplican de abajo hacia arriba, y
  // @HealthCheck() de Terminus registra sus propias respuestas 200 y 503 con
  // `application/json`. Si quedara por encima de las de aqui, se aplicaria de
  // ultimo y las sobreescribiria — que es lo que pasaba y Spectral detecto.
  @Get()
  @ApiOperation({
    security: [],
    summary: 'Verificar el estado de la API y sus dependencias',
    description:
      'Ejecuta los indicadores de salud registrados. Hoy solo verifica la conectividad ' +
      'con PostgreSQL mediante un SELECT 1. Responde 200 si todos los indicadores estan ' +
      'arriba y 503 si alguno falla. Endpoint publico, pensado para los probes de ' +
      'infraestructura; no requiere autenticacion.',
  })
  @ApiResponse({
    status: 200,
    description: 'Todos los indicadores responden correctamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        info: {
          type: 'object',
          example: { database: { status: 'up' } },
          nullable: true,
        },
        error: { type: 'object', example: {}, nullable: true },
        details: {
          type: 'object',
          example: { database: { status: 'up' } },
        },
      },
    },
  })
  // Terminus lanza ServiceUnavailableException cuando un indicador falla, y esa
  // excepcion la captura GlobalExceptionFilter: la respuesta real es RFC 9457,
  // no el formato propio de Terminus. El decorador que Terminus agrega por su
  // cuenta documentaba lo segundo — Spectral lo detecto con la regla
  // fitmess-error-content-type. Este decorador corrige la documentacion para que
  // describa lo que el cliente realmente recibe.
  @ApiProblemResponse(
    503,
    'Alguno de los indicadores de salud no responde (por ejemplo, la base de datos)',
  )
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      async () => {
        await this.prisma.$queryRaw`SELECT 1`;
        return { database: { status: 'up' } };
      },
    ]);
  }
}
