import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter.js';
import { TechnicalError } from '../exceptions/technical-error.enum.js';
import { BASE_ERROR_URI } from '../exceptions/problem-detail.constants.js';

/**
 * Tests del catch-all global (RFC 9457).
 *
 * Es el ultimo filter de la cadena: recibe todo lo que los filters especificos
 * no atrapan. Dos ramas — HttpException nativa de NestJS (guards, pipes) y
 * error completamente inesperado (bug) que nunca debe filtrar detalles internos.
 */
describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: {
    status: ReturnType<typeof vi.fn>;
    header: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
  let mockRequest: { url: string; correlationId?: string };
  // Se guarda el spy en una variable: referenciar Logger.prototype.error en un
  // expect() dispara @typescript-eslint/unbound-method.
  let loggerError: ReturnType<typeof vi.spyOn>;

  /** Construye el ArgumentsHost que el filter espera. */
  function buildHost(): ArgumentsHost {
    return {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  }

  /** Payload del unico json() emitido. */
  function emitted(): Record<string, unknown> {
    return mockResponse.json.mock.calls[0]?.[0] as Record<string, unknown>;
  }

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockRequest = {
      url: '/api/coach-requests/search',
      correlationId: 'correlation-uuid-001',
    };
    // El filter loggea con Logger de NestJS — silenciar para no ensuciar la salida
    loggerError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ── Rama 1: HttpException nativa de NestJS ──────────────────────────────────

  describe('HttpException nativa de NestJS', () => {
    it('preserva el status de la excepcion y responde con problem+json', () => {
      // Act
      filter.catch(new ForbiddenException('Rol insuficiente'), buildHost());

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(mockResponse.header).toHaveBeenCalledWith(
        'Content-Type',
        'application/problem+json',
      );
      expect(emitted()).toMatchObject({
        status: HttpStatus.FORBIDDEN,
        errorCode: TechnicalError.HTTP_ERROR.code,
        type: `${BASE_ERROR_URI}/${TechnicalError.HTTP_ERROR.code}`,
        instance: '/api/coach-requests/search',
        correlationId: 'correlation-uuid-001',
      });
    });

    it('usa el status real de la excepcion, no el httpStatus del catalogo', () => {
      // Arrange — HTTP_ERROR en el catalogo es 400; la excepcion es 401
      // Act
      filter.catch(new UnauthorizedException(), buildHost());

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(emitted()['status']).toBe(HttpStatus.UNAUTHORIZED);
      expect(TechnicalError.HTTP_ERROR.httpStatus).toBe(HttpStatus.BAD_REQUEST);
    });

    it('extrae title y detail cuando getResponse() retorna un objeto', () => {
      // Arrange — forma estandar de NestJS: { statusCode, message, error }
      const exception = new BadRequestException({
        statusCode: 400,
        message: 'El correo electronico no tiene un formato valido',
        error: 'Bad Request',
      });

      // Act
      filter.catch(exception, buildHost());

      // Assert
      expect(emitted()).toMatchObject({
        title: 'Bad Request',
        detail: 'El correo electronico no tiene un formato valido',
      });
    });

    it('usa el string como title y detail cuando getResponse() retorna un string', () => {
      // Arrange
      const exception = new HttpException(
        'Servicio no disponible',
        HttpStatus.SERVICE_UNAVAILABLE,
      );

      // Act
      filter.catch(exception, buildHost());

      // Assert
      expect(emitted()).toMatchObject({
        title: 'Servicio no disponible',
        detail: 'Servicio no disponible',
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    });

    it('cae al title del catalogo cuando el objeto de respuesta no trae error', () => {
      // Arrange — objeto sin la clave `error`
      const exception = new HttpException(
        { statusCode: 418, message: 'Soy una tetera' },
        418,
      );

      // Act
      filter.catch(exception, buildHost());

      // Assert
      expect(emitted()['title']).toBe(TechnicalError.HTTP_ERROR.title);
    });

    it('no loggea las HttpException esperadas — solo son flujo de control', () => {
      // Act
      filter.catch(new ForbiddenException(), buildHost());

      // Assert
      expect(loggerError).not.toHaveBeenCalled();
    });
  });

  // ── Rama 2: error inesperado ────────────────────────────────────────────────

  describe('error inesperado (bug)', () => {
    it('responde 500 con el mensaje generico del catalogo', () => {
      // Act
      filter.catch(new Error('connection pool exhausted'), buildHost());

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.header).toHaveBeenCalledWith(
        'Content-Type',
        'application/problem+json',
      );
      expect(emitted()).toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        errorCode: TechnicalError.INTERNAL_ERROR.code,
        title: TechnicalError.INTERNAL_ERROR.title,
      });
    });

    it('NUNCA expone el mensaje ni el stack del error al cliente', () => {
      // Arrange — mensaje con detalle de infraestructura que no debe filtrarse
      const secreto = 'password=hunter2 host=db.internal.fitmess.co';

      // Act
      filter.catch(new Error(secreto), buildHost());

      // Assert — rulesArquitectura: el originalError se loggea pero nunca se expone
      const payload = JSON.stringify(emitted());
      expect(payload).not.toContain(secreto);
      expect(payload).not.toContain('hunter2');
      expect(payload).not.toContain('db.internal.fitmess.co');
      expect(emitted()['detail']).toBe(
        'Ocurrió un error inesperado. Contacte soporte con el correlationId.',
      );
    });

    it('loggea el stack del error para diagnostico interno', () => {
      // Arrange
      const error = new Error('fallo inesperado');

      // Act
      filter.catch(error, buildHost());

      // Assert
      expect(loggerError).toHaveBeenCalledWith(
        'Unhandled exception',
        error.stack,
      );
    });

    it('maneja valores lanzados que no son Error (throw de un string)', () => {
      // Act
      filter.catch('algo salio mal', buildHost());

      // Assert — no revienta y sigue respondiendo 500 valido
      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(loggerError).toHaveBeenCalledWith(
        'Unhandled exception',
        'algo salio mal',
      );
    });
  });

  // ── Contrato comun a ambas ramas ────────────────────────────────────────────

  describe('contrato RFC 9457', () => {
    it.each([
      ['HttpException', new ForbiddenException()],
      ['Error inesperado', new Error('boom')],
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
      expect(payload['timestamp']).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it('propaga el correlationId ausente sin romper la respuesta', () => {
      // Arrange — request sin correlationId (middleware no ejecutado)
      mockRequest = { url: '/api/health' };

      // Act
      filter.catch(new Error('boom'), buildHost());

      // Assert
      expect(emitted()['correlationId']).toBeUndefined();
      expect(emitted()['instance']).toBe('/api/health');
    });
  });
});
