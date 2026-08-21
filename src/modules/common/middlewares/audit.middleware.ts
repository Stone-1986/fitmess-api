import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuditedRequest } from '../types/audited-request.interface.js';

/**
 * Rutas que no se auditan.
 *
 * Solo el health check: lo golpean los probes de infraestructura cada pocos
 * segundos y no toca ningun dato. Todo lo demas se audita, incluidos los
 * rechazos 401/403 — que son justamente los que interesan ante un intento de
 * acceso indebido (Ley 1273/2009).
 */
const EXCLUDED_PATHS = ['/api/health'];

/**
 * AuditMiddleware — deja rastro de cada request en la tabla `audit_logs`.
 *
 * Es un middleware y NO un interceptor a proposito. En NestJS el orden es
 * middleware -> guards -> interceptores, asi que un interceptor nunca corre
 * cuando un guard rechaza con 401 o 403: los eventos mas relevantes para una
 * auditoria de seguridad serian invisibles. El middleware se registra antes y
 * engancha `res.on('finish')`, que dispara cuando la respuesta ya se envio —
 * momento en el que estan disponibles el status final, la duracion y el
 * `request.user` que el guard haya poblado.
 *
 * La escritura es fire-and-forget despues de `finish`: no demora ninguna
 * respuesta, y si la base falla se loggea el error pero NUNCA se propaga. Una
 * auditoria caida no puede tumbar la operacion que estaba auditando.
 *
 * Que NO se registra, por `rulesArquitectura § Seguridad y privacidad`:
 * - El body del request. Ni siquiera parcialmente. En las busquedas cuyos
 *   criterios viajan en el body (`POST /coach-requests/search`) eso dejaba la
 *   fila diciendo que alguien busco pero no sobre los datos de quien. Se
 *   resolvio por el otro lado: `@AuditResources(...)` +
 *   `AuditResourcesInterceptor` registran los IDs DEVUELTOS en `resourceIds`,
 *   que si pueden guardarse. La pregunta de habeas data se responde con
 *   `resource_ids @> '{id-del-titular}'` sin haber almacenado un solo criterio
 *   de busqueda.
 * - El query string. Se guarda solo el path. Hoy ningun endpoint pasa datos
 *   personales por query, pero guardar la URL completa dejaria la puerta
 *   abierta a que un endpoint futuro los filtre aqui sin que nadie lo note.
 * - Headers de autorizacion, nombres, emails o documentos. De la identidad solo
 *   se guarda el `userId`.
 */
@Injectable()
export class AuditMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuditMiddleware.name);

  constructor(private readonly prisma: PrismaService) {}

  use(req: AuditedRequest, res: Response, next: NextFunction): void {
    const path = req.originalUrl.split('?')[0];

    if (EXCLUDED_PATHS.some((excluded) => path.startsWith(excluded))) {
      next();
      return;
    }

    const startedAt = Date.now();

    res.on('finish', () => {
      void this.prisma.auditLog
        .create({
          data: {
            userId: req.user?.id ?? null,
            ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
            userAgent: req.headers['user-agent'] ?? 'unknown',
            method: req.method,
            url: path,
            statusCode: res.statusCode,
            duration: Date.now() - startedAt,
            correlationId: req.correlationId ?? null,
            error: req.auditErrorCode ?? null,
            // Los pone AuditResourcesInterceptor en los endpoints marcados con
            // @AuditResources(...). Ver la nota de arriba sobre el body.
            resourceType: req.auditedResourceType ?? null,
            resourceIds: req.auditedResourceIds ?? [],
          },
        })
        .catch((error: unknown) => {
          // Nunca relanzar: la respuesta ya se envio y el cliente no debe
          // enterarse de que la auditoria fallo.
          this.logger.error(
            `No se pudo registrar la auditoria de ${req.method} ${path}`,
            error instanceof Error ? error.stack : String(error),
          );
        });
    });

    next();
  }
}
