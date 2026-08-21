import type { Request } from 'express';
import type { AuthUser } from './auth-user.interface.js';

/**
 * Request enriquecido con lo que el pipeline le va agregando y que el
 * AuditMiddleware lee al cerrar la respuesta.
 *
 * - `correlationId` lo pone CorrelationIdMiddleware.
 * - `user` lo pone el guard de Passport al validar el JWT. Es opcional porque
 *   las rutas publicas y los rechazos 401 no llegan a poblarlo.
 * - `auditErrorCode` lo ponen los exception filters. El status HTTP por si solo
 *   no distingue un 403 por rol de un 403 por entrenador no aprobado; el codigo
 *   del catalogo si.
 * - `auditedResourceType` y `auditedResourceIds` los pone
 *   `AuditResourcesInterceptor` en los endpoints marcados con
 *   `@AuditResources(...)`. Quedan `undefined` en el resto, y tambien cuando un
 *   guard rechaza antes de llegar al handler — correcto, ahi no se divulgo nada.
 */
export interface AuditedRequest extends Request {
  correlationId?: string;
  user?: AuthUser;
  auditErrorCode?: string;
  auditedResourceType?: string;
  auditedResourceIds?: string[];
}
