import { Catch, ExceptionFilter, ArgumentsHost, Logger } from '@nestjs/common';
import { BusinessException } from '../exceptions/business.exception.js';
import { TechnicalException } from '../exceptions/technical.exception.js';
import { ProblemDetail } from '../exceptions/problem-detail.dto.js';
import { BASE_ERROR_URI } from '../exceptions/problem-detail.constants.js';

/**
 * Captura BusinessException y TechnicalException y las transforma a RFC 9457.
 *
 * - BusinessException → logger.warn (el usuario hizo algo incorrecto o el negocio no lo permite)
 * - TechnicalException → logger.error con stack trace del error original
 *
 * Registro en main.ts: este filter va ÚLTIMO en el array de useGlobalFilters()
 * porque NestJS aplica los filters en orden LIFO (el último tiene mayor prioridad).
 */
@Catch(BusinessException, TechnicalException)
export class ProblemDetailFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailFilter.name);

  catch(
    exception: BusinessException | TechnicalException,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest<Request & { correlationId?: string }>();
    const status = exception.getStatus();

    // Log técnico completo (con stack trace si es TechnicalException)
    if (exception instanceof TechnicalException) {
      this.logger.error(
        `[${exception.errorEntry.code}] ${exception.detail}`,
        exception.originalError?.stack ?? exception.stack,
      );
    } else {
      this.logger.warn(`[${exception.errorEntry.code}] ${exception.detail}`);
    }

    const problemDetail: ProblemDetail = {
      type: `${BASE_ERROR_URI}/${exception.errorEntry.code}`,
      title: exception.errorEntry.title,
      status,
      detail: exception.detail,
      instance: (request as any).url,
      errorCode: exception.errorEntry.code,
      correlationId: request.correlationId,
      timestamp: new Date().toISOString(),
      context: exception.context,
    };

    response
      .status(status)
      .header('Content-Type', 'application/problem+json')
      .json(problemDetail);
  }
}
