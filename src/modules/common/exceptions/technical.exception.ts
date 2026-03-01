import { HttpException } from '@nestjs/common';
import { TechnicalError } from './technical-error.enum.js';

export class TechnicalException extends HttpException {
  public readonly errorEntry: TechnicalError;
  public readonly detail: string;
  public readonly context?: Record<string, unknown>;
  public readonly originalError?: Error;

  constructor(
    error: TechnicalError,
    detail: string,
    context?: Record<string, unknown>,
    originalError?: Error,
  ) {
    super(
      {
        errorCode: error.code,
        title: error.title,
        detail,
        context,
      },
      error.httpStatus,
    );

    this.errorEntry = error;
    this.detail = detail;
    this.context = context;
    this.originalError = originalError; // Para logging interno, NUNCA se expone al cliente
  }
}
