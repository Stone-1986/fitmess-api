/**
 * Tests unitarios de HealthController.
 *
 * El controller delega a HealthCheckService pasando un indicador que verifica
 * la conectividad real con PostgreSQL. Los tests ejecutan ese indicador para
 * cubrir la clausura, no solo la llamada externa.
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  HealthCheckService,
  HealthCheckResult,
  HealthIndicatorFunction,
} from '@nestjs/terminus';
import { HealthController } from './health.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';

const mockHealthyResult = {
  status: 'ok',
  info: { database: { status: 'up' } },
  error: {},
  details: { database: { status: 'up' } },
} as unknown as HealthCheckResult;

const healthCheckServiceMock = {
  check: vi.fn(),
};

const prismaMock = {
  $queryRaw: vi.fn(),
};

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: healthCheckServiceMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    vi.clearAllMocks();
  });

  it('se instancia correctamente', () => {
    expect(controller).toBeInstanceOf(HealthController);
  });

  describe('check() — GET /health', () => {
    it('delega a HealthCheckService con un unico indicador', async () => {
      // Arrange
      healthCheckServiceMock.check.mockResolvedValue(mockHealthyResult);

      // Act
      await controller.check();

      // Assert
      expect(healthCheckServiceMock.check).toHaveBeenCalledTimes(1);
      const indicadores = healthCheckServiceMock.check.mock
        .calls[0]?.[0] as HealthIndicatorFunction[];
      expect(indicadores).toHaveLength(1);
    });

    it('retorna el resultado del health check sin modificarlo', async () => {
      // Arrange
      healthCheckServiceMock.check.mockResolvedValue(mockHealthyResult);

      // Act
      const result = await controller.check();

      // Assert
      expect(result).toBe(mockHealthyResult);
    });

    it('el indicador consulta la base de datos y reporta up', async () => {
      // Arrange
      healthCheckServiceMock.check.mockResolvedValue(mockHealthyResult);
      prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      await controller.check();
      const indicador = healthCheckServiceMock.check.mock
        .calls[0]?.[0][0] as HealthIndicatorFunction;

      // Act — ejecutar la clausura que HealthCheckService invocaria
      const estado = await indicador();

      // Assert
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
      expect(estado).toEqual({ database: { status: 'up' } });
    });

    it('el indicador propaga el fallo cuando la base de datos no responde', async () => {
      // Arrange
      healthCheckServiceMock.check.mockResolvedValue(mockHealthyResult);
      const error = new Error('connection refused');
      prismaMock.$queryRaw.mockRejectedValue(error);
      await controller.check();
      const indicador = healthCheckServiceMock.check.mock
        .calls[0]?.[0][0] as HealthIndicatorFunction;

      // Act & Assert — Terminus traduce el rechazo a estado down
      await expect(indicador()).rejects.toThrow(error);
    });
  });
});
