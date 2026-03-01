import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  BadRequestException,
} from '@nestjs/common';
import { ProblemDetail } from '../exceptions/problem-detail.dto.js';
import { BASE_ERROR_URI } from '../exceptions/problem-detail.constants.js';
import { TechnicalError } from '../exceptions/technical-error.enum.js';

/**
 * Captura BadRequestException lanzada por ValidationPipe.
 *
 * Usa el flag `isValidation: true` inyectado por `exceptionFactory` en main.ts
 * para discriminar de manera confiable los errores de validación de otros
 * BadRequestException lanzados explícitamente en el código.
 *
 * Si no hay flag (BadRequestException genérico), aplica el código BAD_REQUEST del catálogo.
 */
@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest<Request & { correlationId?: string }>();
    const exceptionResponse = exception.getResponse() as Record<
      string,
      unknown
    >;

    // Discrimina por el flag inyectado por exceptionFactory (ver main.ts)
    const isValidationError = exceptionResponse?.isValidation === true;

    if (isValidationError) {
      const validationEntry = TechnicalError.VALIDATION_ERROR;

      const problemDetail: ProblemDetail = {
        type: `${BASE_ERROR_URI}/${validationEntry.code}`,
        title: validationEntry.title,
        status: validationEntry.httpStatus,
        detail: 'Los datos enviados no cumplen con las validaciones requeridas',
        instance: (request as any).url,
        errorCode: validationEntry.code,
        correlationId: request.correlationId,
        timestamp: new Date().toISOString(),
        errors: exceptionResponse.errors as {
          field: string;
          message: string;
        }[],
      };

      response
        .status(validationEntry.httpStatus)
        .header('Content-Type', 'application/problem+json')
        .json(problemDetail);
    } else {
      // BadRequestException genérico (no de ValidationPipe)
      const badRequestEntry = TechnicalError.BAD_REQUEST;

      response
        .status(badRequestEntry.httpStatus)
        .header('Content-Type', 'application/problem+json')
        .json({
          type: `${BASE_ERROR_URI}/${badRequestEntry.code}`,
          title: badRequestEntry.title,
          status: badRequestEntry.httpStatus,
          detail: (exceptionResponse?.message as string) ?? exception.message,
          instance: (request as any).url,
          errorCode: badRequestEntry.code,
          correlationId: request.correlationId,
          timestamp: new Date().toISOString(),
        } satisfies ProblemDetail);
    }
  }
}
