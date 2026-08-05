import { ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/index.js';
import { PrismaExceptionFilter } from './prisma-exception.filter.js';
import { TechnicalError } from '../exceptions/technical-error.enum.js';
import { BASE_ERROR_URI } from '../exceptions/problem-detail.constants.js';

/**
 * Tests del filter que traduce errores de Prisma a RFC 9457.
 *
 * Cubre los 4 codigos mapeados (P2000, P2002, P2003, P2025) y la rama de
 * codigo desconocido, que debe degradar a 500 sin filtrar el mensaje crudo
 * de Prisma al cliente.
 */
describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;
  let mockResponse: {
    status: ReturnType<typeof vi.fn>;
    header: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
  let mockRequest: { url: string; correlationId?: string };
  // Se guardan los spies en variables: referenciar Logger.prototype.warn/error
  // en un expect() dispara @typescript-eslint/unbound-method.
  let loggerWarn: ReturnType<typeof vi.spyOn>;
  let loggerError: ReturnType<typeof vi.spyOn>;

  /** Construye un PrismaClientKnownRequestError real, no un mock. */
  function prismaError(
    code: string,
    message: string,
    meta?: Record<string, unknown>,
  ): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError(message, {
      code,
      clientVersion: '7.0.0',
      meta,
    });
  }

  function buildHost(): ArgumentsHost {
    return {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  }

  function emitted(): Record<string, unknown> {
    return mockResponse.json.mock.calls[0]?.[0] as Record<string, unknown>;
  }

  beforeEach(() => {
    filter = new PrismaExceptionFilter();
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockRequest = {
      url: '/api/auth/register',
      correlationId: 'correlation-uuid-002',
    };
    loggerWarn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    loggerError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ── Codigos mapeados ────────────────────────────────────────────────────────

  describe('codigos mapeados', () => {
    it.each([
      [
        'P2000',
        TechnicalError.DATABASE_INVALID_DATA.code,
        HttpStatus.UNPROCESSABLE_ENTITY,
      ],
      [
        'P2002',
        TechnicalError.DATABASE_CONSTRAINT_VIOLATION.code,
        HttpStatus.CONFLICT,
      ],
      [
        'P2003',
        TechnicalError.DATABASE_FK_VIOLATION.code,
        HttpStatus.UNPROCESSABLE_ENTITY,
      ],
      ['P2025', TechnicalError.INTERNAL_ERROR.code, HttpStatus.NOT_FOUND],
    ])('%s → %s con status %i', (prismaCode, errorCode, status) => {
      // Act
      filter.catch(prismaError(prismaCode, 'mensaje de prisma'), buildHost());

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(status);
      expect(mockResponse.header).toHaveBeenCalledWith(
        'Content-Type',
        'application/problem+json',
      );
      expect(emitted()).toMatchObject({
        status,
        errorCode,
        type: `${BASE_ERROR_URI}/${errorCode}`,
        instance: '/api/auth/register',
        correlationId: 'correlation-uuid-002',
      });
    });

    it('P2025 usa un title propio, no el del catalogo INTERNAL_ERROR', () => {
      // Arrange — comparte errorCode con INTERNAL_ERROR pero es un 404 de recurso
      // Act
      filter.catch(
        prismaError('P2025', 'Record to update not found.'),
        buildHost(),
      );

      // Assert
      expect(emitted()['title']).toBe('Recurso no encontrado');
      expect(emitted()['title']).not.toBe(TechnicalError.INTERNAL_ERROR.title);
    });

    it('incluye prismaCode y meta en context para diagnostico', () => {
      // Arrange
      const meta = { target: ['email'] };

      // Act
      filter.catch(
        prismaError('P2002', 'Unique constraint failed', meta),
        buildHost(),
      );

      // Assert
      expect(emitted()['context']).toEqual({
        prismaCode: 'P2002',
        meta,
      });
    });

    it('usa la ultima linea del mensaje de Prisma como detail', () => {
      // Arrange — Prisma emite mensajes multilinea con la invocacion completa
      const message =
        'Invalid `prisma.user.create()` invocation:\n\n\nUnique constraint failed on the fields: (`email`)';

      // Act
      filter.catch(prismaError('P2002', message), buildHost());

      // Assert
      expect(emitted()['detail']).toBe(
        'Error de base de datos: Unique constraint failed on the fields: (`email`)',
      );
    });

    it('loggea como warn — es un error esperado del dominio', () => {
      // Act
      filter.catch(
        prismaError('P2002', 'Unique constraint failed'),
        buildHost(),
      );

      // Assert
      expect(loggerWarn).toHaveBeenCalled();
      expect(loggerError).not.toHaveBeenCalled();
    });
  });

  // ── Codigo desconocido ──────────────────────────────────────────────────────

  describe('codigo no mapeado', () => {
    it.each(['P2014', 'P2016', 'P2021', 'P9999'])(
      '%s degrada a 500 generico',
      (prismaCode) => {
        // Act
        filter.catch(prismaError(prismaCode, 'error desconocido'), buildHost());

        // Assert
        expect(mockResponse.status).toHaveBeenCalledWith(
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
        expect(emitted()).toMatchObject({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          errorCode: TechnicalError.INTERNAL_ERROR.code,
          title: TechnicalError.INTERNAL_ERROR.title,
          detail: 'Error interno del servidor',
        });
      },
    );

    it('NUNCA expone el mensaje crudo de Prisma al cliente', () => {
      // Arrange — un error no mapeado puede revelar nombres de tabla y columnas
      const message =
        'The table `public.users` does not exist in the current database. Host: db.internal.fitmess.co';

      // Act
      filter.catch(prismaError('P2021', message), buildHost());

      // Assert
      const payload = JSON.stringify(emitted());
      expect(payload).not.toContain('public.users');
      expect(payload).not.toContain('db.internal.fitmess.co');
      expect(emitted()['detail']).toBe('Error interno del servidor');
    });

    it('no incluye context en la rama no mapeada', () => {
      // Act
      filter.catch(prismaError('P2021', 'tabla inexistente'), buildHost());

      // Assert — el context llevaria meta de Prisma con detalles del schema
      expect(emitted()['context']).toBeUndefined();
    });

    it('loggea como error con el stack para diagnostico interno', () => {
      // Arrange
      const exception = prismaError('P2021', 'tabla inexistente');

      // Act
      filter.catch(exception, buildHost());

      // Assert
      expect(loggerError).toHaveBeenCalledWith(
        `Prisma error no mapeado [P2021]: ${exception.message}`,
        exception.stack,
      );
      expect(loggerWarn).not.toHaveBeenCalled();
    });
  });

  // ── Contrato comun ──────────────────────────────────────────────────────────

  describe('contrato RFC 9457', () => {
    it.each(['P2002', 'P2021'])(
      'emite todos los campos obligatorios para %s',
      (prismaCode) => {
        // Act
        filter.catch(prismaError(prismaCode, 'mensaje'), buildHost());

        // Assert
        const payload = emitted();
        for (const campo of [
          'type',
          'title',
          'status',
          'detail',
          'instance',
          'errorCode',
          'timestamp',
        ]) {
          expect(payload[campo]).toBeDefined();
        }
        expect(payload['timestamp']).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        );
      },
    );

    it('funciona sin correlationId cuando el middleware no corrio', () => {
      // Arrange
      mockRequest = { url: '/api/health' };

      // Act
      filter.catch(prismaError('P2002', 'constraint'), buildHost());

      // Assert
      expect(emitted()['correlationId']).toBeUndefined();
      expect(emitted()['instance']).toBe('/api/health');
    });
  });
});
