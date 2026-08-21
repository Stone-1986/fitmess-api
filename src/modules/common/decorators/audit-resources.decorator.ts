import { SetMetadata } from '@nestjs/common';

export const AUDIT_RESOURCES_KEY = 'auditResources';

/**
 * Marca un endpoint cuyos recursos devueltos deben quedar registrados en la
 * fila de auditoria (`audit_logs.resource_type` y `resource_ids`).
 *
 * Se aplica a los endpoints que DIVULGAN datos personales de terceros sin que
 * el identificador del titular aparezca en la URL — tipicamente busquedas cuyos
 * criterios viajan en el body. En esas rutas la fila de auditoria registra que
 * alguien consulto, pero no sobre los datos de quien, porque
 * `rulesArquitectura § Seguridad y privacidad` prohibe registrar el body
 * (hallazgo #9).
 *
 * NO hace falta en los endpoints que llevan el id en la URL: ahi la columna
 * `url` ya identifica al titular consultado.
 *
 * @example
 * ```ts
 * @Post('search')
 * @AuditResources('CoachRequest')
 * async search(@Body() dto: SearchCoachRequestsDto) { ... }
 * ```
 *
 * El `resourceType` es el nombre del modelo de Prisma cuyos IDs se registran
 * — sirve para interpretar los `resourceIds` sin adivinar contra que tabla
 * resolverlos.
 */
export const AuditResources = (resourceType: string) =>
  SetMetadata(AUDIT_RESOURCES_KEY, resourceType);
