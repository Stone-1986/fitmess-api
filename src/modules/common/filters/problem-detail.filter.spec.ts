import { ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { ProblemDetailFilter } from './problem-detail.filter.js';
import { BusinessException } from '../exceptions/business.exception.js';
import { BusinessError } from '../exceptions/business-error.enum.js';
import { TechnicalException } from '../exceptions/technical.exception.js';
import { TechnicalError } from '../exceptions/technical-error.enum.js';
import { BASE_ERROR_URI } from '../exceptions/problem-detail.constants.js';

/**
 * Tests del filter principal de errores de dominio (RFC 9457).
 *
 * Es la ruta de error mas transitada de la API: cada 403, 404, 409 y 422 de
 * negocio pasa por aqui. Dos ramas — BusinessException (warn) y
 * TechnicalException (error con stack), esta ultima con la garantia critica de
 * que el `originalError` se loggea pero NUNCA se expone al cliente
 * (rulesArquitectura § Seguridad y privacidad).
 */
describe('ProblemDetailFilter', () => {
  let filter: ProblemDetailFilter;
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
    filter = new ProblemDetailFilter();
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockRequest = {
      url: '/api/plans/plan-uuid/publish',
      correlationId: 'correlation-uuid-003',
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

  // ── BusinessException ───────────────────────────────────────────────────────

  describe('BusinessException', () => {
    it.each([
      [
        'ENTITY_NOT_FOUND',
        BusinessError.ENTITY_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      ],
      [
        'INVALID_STATE_TRANSITION',
        BusinessError.INVALID_STATE_TRANSITION,
        HttpStatus.CONFLICT,
      ],
      [
        'CONSENT_REQUIRED',
        BusinessError.CONSENT_REQUIRED,
        HttpStatus.UNPROCESSABLE_ENTITY,
      ],
      [
        'RESOURCE_OWNERSHIP_DENIED',
        BusinessError.RESOURCE_OWNERSHIP_DENIED,
        HttpStatus.FORBIDDEN,
      ],
    ])('%s responde con el status del catalogo (%i)', (_n, entry, status) => {
      // Act
      filter.catch(new BusinessException(entry, 'detalle'), buildHost());

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(status);
      expect(mockResponse.header).toHaveBeenCalledWith(
        'Content-Type',
        'application/problem+json',
      );
      expect(emitted()).toMatchObject({
        status,
        errorCode: entry.code,
        title: entry.title,
        type: `${BASE_ERROR_URI}/${entry.code}`,
      });
    });

    it('usa el detail de la excepcion, no el title del catalogo', () => {
      // Arrange — el title es estable entre ocurrencias; el detail es especifico
      const detail =
        "No se puede transicionar Plan de 'ARCHIVED' a 'PUBLISHED'";

      // Act
      filter.catch(
        new BusinessException(BusinessError.INVALID_STATE_TRANSITION, detail),
        buildHost(),
      );

      // Assert
      expect(emitted()['detail']).toBe(detail);
      expect(emitted()['title']).toBe(
        BusinessError.INVALID_STATE_TRANSITION.title,
      );
    });

    it('propaga el context al cliente', () => {
      // Arrange
      const context = {
        entity: 'Plan',
        currentState: 'ARCHIVED',
        targetState: 'PUBLISHED',
      };

      // Act
      filter.catch(
        new BusinessException(
          BusinessError.INVALID_STATE_TRANSITION,
          'detalle',
          context,
        ),
        buildHost(),
      );

      // Assert
      expect(emitted()['context']).toEqual(context);
    });

    it('loggea como warn — el usuario hizo algo que el negocio no permite', () => {
      // Act
      filter.catch(
        new BusinessException(BusinessError.ENTITY_NOT_FOUND, 'no encontrado'),
        buildHost(),
      );

      // Assert
      expect(loggerWarn).toHaveBeenCalledWith(
        '[ENTITY_NOT_FOUND] no encontrado',
      );
      expect(loggerError).not.toHaveBeenCalled();
    });
  });

  // ── TechnicalException ──────────────────────────────────────────────────────

  describe('TechnicalException', () => {
    it('responde con el status del catalogo tecnico', () => {
      // Act
      filter.catch(
        new TechnicalException(
          TechnicalError.DATABASE_CONNECTION_ERROR,
          'La base de datos no responde',
        ),
        buildHost(),
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
      expect(emitted()).toMatchObject({
        errorCode: TechnicalError.DATABASE_CONNECTION_ERROR.code,
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    });

    it('NUNCA expone el originalError al cliente', () => {
      // Arrange — rulesArquitectura: el originalError se loggea pero nunca
      // se expone. Suele traer credenciales y hosts de infraestructura.
      const originalError = new Error(
        'connect ECONNREFUSED postgres://admin:hunter2@db.internal.fitmess.co:5432',
      );

      // Act
      filter.catch(
        new TechnicalException(
          TechnicalError.DATABASE_ERROR,
          'Error al consultar la base de datos',
          { operation: 'findMany' },
          originalError,
        ),
        buildHost(),
      );

      // Assert
      const payload = JSON.stringify(emitted());
      expect(payload).not.toContain('ECONNREFUSED');
      expect(payload).not.toContain('hunter2');
      expect(payload).not.toContain('db.internal.fitmess.co');
      expect(emitted()).not.toHaveProperty('originalError');
      expect(emitted()['detail']).toBe('Error al consultar la base de datos');
    });

    it('loggea el stack del originalError para diagnostico interno', () => {
      // Arrange
      const originalError = new Error('connection timeout');

      // Act
      filter.catch(
        new TechnicalException(
          TechnicalError.DATABASE_ERROR,
          'Error al consultar la base de datos',
          undefined,
          originalError,
        ),
        buildHost(),
      );

      // Assert
      expect(loggerError).toHaveBeenCalledWith(
        '[DATABASE_ERROR] Error al consultar la base de datos',
        originalError.stack,
      );
      expect(loggerWarn).not.toHaveBeenCalled();
    });

    it('cae al stack propio cuando no hay originalError', () => {
      // Arrange
      const exception = new TechnicalException(
        TechnicalError.EXTERNAL_SERVICE_TIMEOUT,
        'El servicio externo no respondio a tiempo',
      );

      // Act
      filter.catch(exception, buildHost());

      // Assert
      expect(loggerError).toHaveBeenCalledWith(
        '[EXTERNAL_SERVICE_TIMEOUT] El servicio externo no respondio a tiempo',
        exception.stack,
      );
    });
  });

  // ── Contrato comun ──────────────────────────────────────────────────────────

  describe('contrato RFC 9457', () => {
    it.each([
      [
        'BusinessException',
        new BusinessException(BusinessError.ENTITY_NOT_FOUND, 'detalle'),
      ],
      [
        'TechnicalException',
        new TechnicalException(TechnicalError.DATABASE_ERROR, 'detalle'),
      ],
    ])('emite todos los campos obligatorios para %s', (_caso, exception) => {
      // Act
      filter.catch(exception, buildHost());

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
      expect(payload['instance']).toBe('/api/plans/plan-uuid/publish');
      expect(payload['correlationId']).toBe('correlation-uuid-003');
      expect(payload['timestamp']).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it('omite context cuando la excepcion no lo trae', () => {
      // Act
      filter.catch(
        new BusinessException(BusinessError.ENTITY_NOT_FOUND, 'detalle'),
        buildHost(),
      );

      // Assert
      expect(emitted()['context']).toBeUndefined();
    });

    it('funciona sin correlationId cuando el middleware no corrio', () => {
      // Arrange
      mockRequest = { url: '/api/health' };

      // Act
      filter.catch(
        new BusinessException(BusinessError.ENTITY_NOT_FOUND, 'detalle'),
        buildHost(),
      );

      // Assert
      expect(emitted()['correlationId']).toBeUndefined();
      expect(emitted()['instance']).toBe('/api/health');
    });
  });
});
