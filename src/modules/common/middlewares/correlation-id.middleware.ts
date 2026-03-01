import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Middleware que genera o propaga un Correlation ID por cada request.
 *
 * Comportamiento:
 * - Si el cliente envía el header `x-correlation-id`, se reutiliza el valor.
 * - Si no, se genera un nuevo UUID v4.
 * - El ID se adjunta a `request.correlationId` para que los exception filters
 *   y servicios puedan accederlo durante todo el ciclo de vida del request.
 * - El ID se devuelve en el header `x-correlation-id` de la respuesta
 *   para que el cliente pueda usarlo en reportes de incidencias.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(
    req: Request & { correlationId?: string },
    res: Response,
    next: NextFunction,
  ): void {
    const correlationId =
      (req.headers['x-correlation-id'] as string | undefined) ?? randomUUID();

    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    next();
  }
}
