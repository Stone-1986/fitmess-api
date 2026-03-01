import { HttpException } from '@nestjs/common';
import { BusinessError } from './business-error.enum.js';

export class BusinessException extends HttpException {
  public readonly errorEntry: BusinessError;
  public readonly detail: string;
  public readonly context?: Record<string, unknown>;

  constructor(
    error: BusinessError,
    detail: string,
    context?: Record<string, unknown>,
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
  }
}
