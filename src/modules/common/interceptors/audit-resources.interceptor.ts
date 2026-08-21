import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUDIT_RESOURCES_KEY } from '../decorators/audit-resources.decorator.js';
import type { AuditedRequest } from '../types/audited-request.interface.js';

/**
 * Extrae los IDs de los recursos que devuelve un endpoint marcado con
 * `@AuditResources(...)` y los deja en el request para que `AuditMiddleware`
 * los escriba al cerrar la respuesta.
 *
 * Es un interceptor y no un middleware porque el middleware corre ANTES del
 * handler: no puede ver lo que el endpoint devuelve. El interceptor si, y sigue
 * corriendo antes de que se emita la respuesta, asi que `res.on('finish')`
 * encuentra los valores ya puestos — el mismo mecanismo por el que el guard
 * deja `request.user`.
 *
 * Si un guard rechaza el request, este interceptor NO corre y la fila queda sin
 * `resourceIds`. Es correcto: no se divulgo ningun dato.
 *
 * NO contiene logica de negocio ni accede a PrismaService — solo lee lo que el
 * handler ya devolvio.
 */
@Injectable()
export class AuditResourcesInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const resourceType = this.reflector.getAllAndOverride<string | undefined>(
      AUDIT_RESOURCES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Sin el decorador no se toca nada: la inmensa mayoria de endpoints no
    // divulga datos de terceros y no necesita este registro.
    if (!resourceType) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuditedRequest>();

    return next.handle().pipe(
      tap((payload: unknown) => {
        request.auditedResourceType = resourceType;
        request.auditedResourceIds = extractIds(payload);
      }),
    );
  }
}

/**
 * Saca los `id` de la carga util del endpoint.
 *
 * Soporta las tres formas que un controller puede retornar (`data` plano,
 * `{ data, meta }` y `{ data, message }`) y tambien el envelope ya construido
 * por `ResponseInterceptor`, porque el orden relativo entre los dos
 * interceptores no cambia el resultado: en ambos casos la carga real cuelga de
 * `data`.
 *
 * La comprobacion es `'data' in payload`, NUNCA `payload.data ?? payload` — es
 * la misma leccion del bug de `ResponseInterceptor` que aparecio en EPICA-02:
 * `??` no distingue una clave `data` explicitamente nula de una clave ausente.
 */
function extractIds(payload: unknown): string[] {
  const root =
    payload && typeof payload === 'object' && 'data' in payload
      ? (payload as { data: unknown }).data
      : payload;

  const items = Array.isArray(root) ? root : [root];

  return items
    .filter(
      (item): item is { id: string } =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as { id?: unknown }).id === 'string',
    )
    .map((item) => item.id);
}
