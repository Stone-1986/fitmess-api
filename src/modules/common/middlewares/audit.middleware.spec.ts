import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Response, NextFunction } from 'express';
import { AuditMiddleware } from './audit.middleware.js';
import type { AuditedRequest } from '../types/audited-request.interface.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserRole } from '../../../../generated/prisma/index.js';

/**
 * Los tests disparan `finish` a mano: el middleware no escribe durante `use()`,
 * solo registra el listener. Esa es justamente la garantia que interesa —
 * ninguna respuesta se demora por la auditoria.
 */
function buildRequest(overrides: Partial<AuditedRequest> = {}): AuditedRequest {
  return {
    originalUrl: '/api/exercises?page=1',
    method: 'GET',
    ip: '190.0.0.1',
    headers: { 'user-agent': 'vitest' },
    socket: { remoteAddress: '10.0.0.1' },
    correlationId: 'corr-1',
    ...overrides,
  } as AuditedRequest;
}

function buildResponse(statusCode = 200): {
  res: Response;
  finish: () => void;
} {
  const listeners: (() => void)[] = [];
  const res = {
    statusCode,
    on: (event: string, cb: () => void) => {
      if (event === 'finish') listeners.push(cb);
    },
  } as unknown as Response;

  return { res, finish: () => listeners.forEach((cb) => cb()) };
}

describe('AuditMiddleware', () => {
  let create: ReturnType<typeof vi.fn>;
  let middleware: AuditMiddleware;
  let next: NextFunction;

  beforeEach(() => {
    create = vi.fn().mockResolvedValue({});
    middleware = new AuditMiddleware({
      auditLog: { create },
    } as unknown as PrismaService);
    next = vi.fn();
  });

  it('siempre llama a next() y no escribe nada antes de que la respuesta cierre', () => {
    const { res } = buildResponse();

    middleware.use(buildRequest(), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });

  it('registra la fila al cerrar la respuesta', () => {
    const { res, finish } = buildResponse(201);

    middleware.use(
      buildRequest({ method: 'POST', originalUrl: '/api/exercises' }),
      res,
      next,
    );
    finish();

    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.method).toBe('POST');
    expect(data.url).toBe('/api/exercises');
    expect(data.statusCode).toBe(201);
    expect(data.correlationId).toBe('corr-1');
    expect(typeof data.duration).toBe('number');
  });

  it('guarda solo el path — el query string NUNCA se registra', () => {
    const { res, finish } = buildResponse();

    middleware.use(
      buildRequest({ originalUrl: '/api/exercises?page=2&secreto=valor' }),
      res,
      next,
    );
    finish();

    const data = create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.url).toBe('/api/exercises');
    expect(JSON.stringify(data)).not.toContain('secreto');
  });

  it('registra el userId cuando el guard pobló request.user', () => {
    const { res, finish } = buildResponse();

    middleware.use(
      buildRequest({
        user: { id: 'user-1', email: 'coach@test.com', role: UserRole.COACH },
      }),
      res,
      next,
    );
    finish();

    const data = create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.userId).toBe('user-1');
  });

  it('NUNCA registra el email ni el rol del usuario, solo su id', () => {
    const { res, finish } = buildResponse();

    middleware.use(
      buildRequest({
        user: { id: 'user-1', email: 'coach@test.com', role: UserRole.COACH },
      }),
      res,
      next,
    );
    finish();

    const serializado = JSON.stringify(create.mock.calls[0][0].data);
    expect(serializado).not.toContain('coach@test.com');
    expect(serializado).not.toContain(UserRole.COACH);
  });

  it('registra userId null cuando la request no está autenticada', () => {
    const { res, finish } = buildResponse(401);

    middleware.use(buildRequest(), res, next);
    finish();

    const data = create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.userId).toBeNull();
    expect(data.statusCode).toBe(401);
  });

  it('registra el errorCode que dejó el exception filter', () => {
    const { res, finish } = buildResponse(403);

    middleware.use(
      buildRequest({ auditErrorCode: 'COACH_NOT_APPROVED' }),
      res,
      next,
    );
    finish();

    const data = create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.error).toBe('COACH_NOT_APPROVED');
  });

  it('deja error en null cuando la respuesta fue exitosa', () => {
    const { res, finish } = buildResponse();

    middleware.use(buildRequest(), res, next);
    finish();

    const data = create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.error).toBeNull();
  });

  it('registra los IDs que dejó AuditResourcesInterceptor (hallazgo #9)', () => {
    const { res, finish } = buildResponse();

    middleware.use(
      buildRequest({
        method: 'POST',
        originalUrl: '/api/coach-requests/search',
        auditedResourceType: 'CoachRequest',
        auditedResourceIds: ['req-1', 'req-2'],
      }),
      res,
      next,
    );
    finish();

    const data = create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.resourceType).toBe('CoachRequest');
    expect(data.resourceIds).toEqual(['req-1', 'req-2']);
  });

  it('deja resourceIds vacío cuando el endpoint no está marcado con @AuditResources', () => {
    const { res, finish } = buildResponse();

    middleware.use(buildRequest(), res, next);
    finish();

    const data = create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.resourceType).toBeNull();
    // Array vacío, NUNCA null: la columna es String[] y un null rompería el insert.
    expect(data.resourceIds).toEqual([]);
  });

  it('cae al remoteAddress del socket cuando req.ip no está disponible', () => {
    const { res, finish } = buildResponse();

    middleware.use(buildRequest({ ip: undefined }), res, next);
    finish();

    const data = create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.ip).toBe('10.0.0.1');
  });

  it('usa "unknown" cuando falta el user-agent', () => {
    const { res, finish } = buildResponse();

    middleware.use(buildRequest({ headers: {} }), res, next);
    finish();

    const data = create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.userAgent).toBe('unknown');
  });

  it('no audita el health check', () => {
    const { res, finish } = buildResponse();

    middleware.use(buildRequest({ originalUrl: '/api/health' }), res, next);
    finish();

    expect(next).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });

  it('un fallo de la base NUNCA se propaga — la auditoría no puede tumbar la operación', async () => {
    create.mockRejectedValue(new Error('conexión perdida'));
    const { res, finish } = buildResponse();

    middleware.use(buildRequest(), res, next);

    expect(() => finish()).not.toThrow();
    // Deja que la promesa rechazada se resuelva sin dejar un unhandled rejection
    await Promise.resolve();
    expect(create).toHaveBeenCalledTimes(1);
  });
});
