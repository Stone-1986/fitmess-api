import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/index.js';
import { ProblemDetail } from '../exceptions/problem-detail.dto.js';
import { BASE_ERROR_URI } from '../exceptions/problem-detail.constants.js';
import { TechnicalError } from '../exceptions/technical-error.enum.js';

/**
 * Mapeo de códigos de error de Prisma a entradas del catálogo TechnicalError.
 *
 * Códigos mapeados:
 * - P2000: Valor demasiado largo para la columna → 422
 * - P2002: Unique constraint violation → 409
 * - P2003: Foreign key constraint violation → 422
 * - P2025: Registro no encontrado → 404
 *
 * Códigos conocidos no mapeados (caen al 500 genérico):
 * - P2014: Violación de relación requerida
 * - P2016: Error de consulta (campo no existe en schema)
 * - P2021: Tabla no existe en la base de datos
 */
const PRISMA_MAP: Record<
  string,
  { code: string; title: string; status: number }
> = {
  P2000: {
    code: TechnicalError.DATABASE_INVALID_DATA.code,
    title: TechnicalError.DATABASE_INVALID_DATA.title,
    status: TechnicalError.DATABASE_INVALID_DATA.httpStatus, // 422
  },
  P2002: {
    code: TechnicalError.DATABASE_CONSTRAINT_VIOLATION.code,
    title: TechnicalError.DATABASE_CONSTRAINT_VIOLATION.title,
    status: TechnicalError.DATABASE_CONSTRAINT_VIOLATION.httpStatus, // 409
  },
  P2003: {
    code: TechnicalError.DATABASE_FK_VIOLATION.code,
    title: TechnicalError.DATABASE_FK_VIOLATION.title,
    status: TechnicalError.DATABASE_FK_VIOLATION.httpStatus, // 422
  },
  P2025: {
    code: TechnicalError.INTERNAL_ERROR.code, // El filter de negocio maneja 404,
    title: 'Recurso no encontrado', // pero si Prisma lo lanza directamente usamos genérico
    status: HttpStatus.NOT_FOUND, // 404
  },
};

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest<Request & { correlationId?: string }>();

    const mapping = PRISMA_MAP[exception.code];

    if (mapping) {
      this.logger.warn(
        `[Prisma ${exception.code}] ${mapping.code}: ${exception.message}`,
      );

      const problemDetail: ProblemDetail = {
        type: `${BASE_ERROR_URI}/${mapping.code}`,
        title: mapping.title,
        status: mapping.status,
        detail: `Error de base de datos: ${exception.message.split('\n').pop()?.trim()}`,
        instance: (request as any).url,
        errorCode: mapping.code,
        correlationId: request.correlationId,
        timestamp: new Date().toISOString(),
        context: {
          prismaCode: exception.code,
          meta: exception.meta as Record<string, unknown>,
        },
      };

      response
        .status(mapping.status)
        .header('Content-Type', 'application/problem+json')
        .json(problemDetail);
    } else {
      // Prisma error no mapeado → 500
      this.logger.error(
        `Prisma error no mapeado [${exception.code}]: ${exception.message}`,
        exception.stack,
      );

      const internalEntry = TechnicalError.INTERNAL_ERROR;

      response
        .status(internalEntry.httpStatus)
        .header('Content-Type', 'application/problem+json')
        .json({
          type: `${BASE_ERROR_URI}/${internalEntry.code}`,
          title: internalEntry.title,
          status: internalEntry.httpStatus,
          detail: 'Error interno del servidor',
          instance: (request as any).url,
          errorCode: internalEntry.code,
          correlationId: request.correlationId,
          timestamp: new Date().toISOString(),
        } satisfies ProblemDetail);
    }
  }
}
