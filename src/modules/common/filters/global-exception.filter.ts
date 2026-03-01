import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ProblemDetail } from '../exceptions/problem-detail.dto.js';
import { BASE_ERROR_URI } from '../exceptions/problem-detail.constants.js';
import { TechnicalError } from '../exceptions/technical-error.enum.js';

/**
 * Catch-all global: captura cualquier excepción no atrapada por los filters más específicos.
 *
 * Maneja dos casos:
 * 1. HttpException nativa de NestJS (guards, interceptors, excepciones explícitas de NestJS)
 * 2. Errores completamente inesperados (bugs, errores de runtime) → 500 genérico
 *
 * Registro en main.ts: este filter va PRIMERO en el array de useGlobalFilters()
 * porque NestJS aplica los filters en orden LIFO (el último registrado tiene mayor prioridad).
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest<Request & { correlationId?: string }>();

    // HttpException nativa de NestJS (Unauthorized, Forbidden de guards, etc.)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const httpEntry = TechnicalError.HTTP_ERROR;

      const title =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (((exceptionResponse as Record<string, unknown>).error as string) ??
            httpEntry.title);

      const detail =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (((exceptionResponse as Record<string, unknown>)
              .message as string) ?? exception.message);

      const problemDetail: ProblemDetail = {
        type: `${BASE_ERROR_URI}/${httpEntry.code}`,
        title,
        status,
        detail,
        instance: (request as any).url,
        errorCode: httpEntry.code,
        correlationId: request.correlationId,
        timestamp: new Date().toISOString(),
      };

      response
        .status(status)
        .header('Content-Type', 'application/problem+json')
        .json(problemDetail);
      return;
    }

    // Error completamente inesperado → 500 genérico
    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : String(exception),
    );

    const internalEntry = TechnicalError.INTERNAL_ERROR;

    const problemDetail: ProblemDetail = {
      type: `${BASE_ERROR_URI}/${internalEntry.code}`,
      title: internalEntry.title,
      status: internalEntry.httpStatus,
      detail:
        'Ocurrió un error inesperado. Contacte soporte con el correlationId.',
      instance: (request as any).url,
      errorCode: internalEntry.code,
      correlationId: request.correlationId,
      timestamp: new Date().toISOString(),
    };

    response
      .status(internalEntry.httpStatus)
      .header('Content-Type', 'application/problem+json')
      .json(problemDetail);
  }
}
