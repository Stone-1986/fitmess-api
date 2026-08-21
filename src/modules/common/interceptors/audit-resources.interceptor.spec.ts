import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, lastValueFrom } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditResourcesInterceptor } from './audit-resources.interceptor.js';
import type { AuditedRequest } from '../types/audited-request.interface.js';

/**
 * El interceptor no escribe en base: solo deja `auditedResourceType` y
 * `auditedResourceIds` en el request para que AuditMiddleware los recoja al
 * cerrar la respuesta. Lo que se verifica aqui es exactamente eso.
 */
function buildContext(request: AuditedRequest): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function buildHandler(payload: unknown): CallHandler {
  return { handle: () => of(payload) };
}

describe('AuditResourcesInterceptor', () => {
  let reflector: Reflector;
  let request: AuditedRequest;

  beforeEach(() => {
    reflector = new Reflector();
    request = {} as AuditedRequest;
  });

  const marcarComo = (resourceType: string | undefined) =>
    vi
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(resourceType as unknown as string);

  it('no toca el request cuando el endpoint NO tiene @AuditResources', async () => {
    marcarComo(undefined);
    const interceptor = new AuditResourcesInterceptor(reflector);

    const payload = { data: [{ id: 'a' }] };
    const result = await lastValueFrom(
      interceptor.intercept(buildContext(request), buildHandler(payload)),
    );

    expect(result).toBe(payload);
    expect(request.auditedResourceType).toBeUndefined();
    expect(request.auditedResourceIds).toBeUndefined();
  });

  it('extrae los IDs de un listado paginado { data, meta }', async () => {
    marcarComo('CoachRequest');
    const interceptor = new AuditResourcesInterceptor(reflector);

    await lastValueFrom(
      interceptor.intercept(
        buildContext(request),
        buildHandler({
          data: [{ id: 'req-1' }, { id: 'req-2' }],
          meta: { page: 1, limit: 20 },
        }),
      ),
    );

    expect(request.auditedResourceType).toBe('CoachRequest');
    expect(request.auditedResourceIds).toEqual(['req-1', 'req-2']);
  });

  it('extrae el ID de un recurso unico devuelto plano', async () => {
    marcarComo('CoachRequest');
    const interceptor = new AuditResourcesInterceptor(reflector);

    await lastValueFrom(
      interceptor.intercept(
        buildContext(request),
        buildHandler({ id: 'req-9', status: 'PENDING' }),
      ),
    );

    expect(request.auditedResourceIds).toEqual(['req-9']);
  });

  it('funciona igual sobre el envelope ya construido por ResponseInterceptor', async () => {
    // El orden relativo de los dos interceptores no debe cambiar el resultado:
    // en ambos casos la carga real cuelga de `data`.
    marcarComo('CoachRequest');
    const interceptor = new AuditResourcesInterceptor(reflector);

    await lastValueFrom(
      interceptor.intercept(
        buildContext(request),
        buildHandler({
          success: true,
          statusCode: 200,
          data: [{ id: 'req-1' }],
          timestamp: '2026-08-21T00:00:00.000Z',
        }),
      ),
    );

    expect(request.auditedResourceIds).toEqual(['req-1']);
  });

  it('devuelve lista vacia cuando la busqueda no arrojo resultados', async () => {
    // Correcto y deliberado: no se divulgo ningun dato, no hay a quien auditar.
    marcarComo('CoachRequest');
    const interceptor = new AuditResourcesInterceptor(reflector);

    await lastValueFrom(
      interceptor.intercept(
        buildContext(request),
        buildHandler({ data: [], meta: { page: 1, limit: 20 } }),
      ),
    );

    expect(request.auditedResourceIds).toEqual([]);
  });

  it('ignora los elementos sin id en vez de romper', async () => {
    marcarComo('CoachRequest');
    const interceptor = new AuditResourcesInterceptor(reflector);

    await lastValueFrom(
      interceptor.intercept(
        buildContext(request),
        buildHandler({ data: [{ id: 'req-1' }, { nombre: 'sin id' }, null] }),
      ),
    );

    expect(request.auditedResourceIds).toEqual(['req-1']);
  });

  it('trata `data: null` como ausencia de recursos, no como el objeto envolvente', async () => {
    // Misma leccion del bug de ResponseInterceptor en EPICA-02: la comprobacion
    // es `'data' in payload`, nunca `payload.data ?? payload` — con `??` este
    // caso caeria al fallback y registraria el envolvente como si fuera el
    // recurso.
    marcarComo('CoachRequest');
    const interceptor = new AuditResourcesInterceptor(reflector);

    await lastValueFrom(
      interceptor.intercept(
        buildContext(request),
        buildHandler({ data: null, message: 'Eliminado' }),
      ),
    );

    expect(request.auditedResourceIds).toEqual([]);
  });

  it('descarta un id que no sea string', async () => {
    marcarComo('CoachRequest');
    const interceptor = new AuditResourcesInterceptor(reflector);

    await lastValueFrom(
      interceptor.intercept(
        buildContext(request),
        buildHandler({ data: [{ id: 42 }, { id: 'req-1' }] }),
      ),
    );

    expect(request.auditedResourceIds).toEqual(['req-1']);
  });
});
