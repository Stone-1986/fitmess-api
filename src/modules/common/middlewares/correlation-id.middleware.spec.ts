import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { CorrelationIdMiddleware } from './correlation-id.middleware.js';

/**
 * Estaba en 0% de cobertura (hallazgo abierto #2b) pese a que su valor ahora es
 * mayor que cuando se escribió: el correlationId que genera es el que liga cada
 * fila de `audit_logs` con las líneas del log de la aplicación y con el
 * problem+json que recibe el cliente.
 */
describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;
  let setHeader: ReturnType<typeof vi.fn>;
  let next: NextFunction;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
    setHeader = vi.fn();
    next = vi.fn();
  });

  function run(headers: Record<string, string | undefined> = {}) {
    const req = { headers } as unknown as Request & { correlationId?: string };
    const res = { setHeader } as unknown as Response;
    middleware.use(req, res, next);
    return req;
  }

  it('genera un UUID cuando el cliente no envía x-correlation-id', () => {
    const req = run();

    expect(req.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('reutiliza el x-correlation-id que envía el cliente', () => {
    const req = run({ 'x-correlation-id': 'trace-del-cliente' });

    expect(req.correlationId).toBe('trace-del-cliente');
  });

  it('devuelve el id en el header de la respuesta para que el cliente lo cite en un reporte', () => {
    run({ 'x-correlation-id': 'trace-del-cliente' });

    expect(setHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      'trace-del-cliente',
    );
  });

  it('el id del request y el del header de respuesta son el mismo', () => {
    const req = run();

    expect(setHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      req.correlationId,
    );
  });

  it('genera un id distinto por cada request', () => {
    const primero = run().correlationId;
    const segundo = run().correlationId;

    expect(primero).not.toBe(segundo);
  });

  it('siempre continúa la cadena', () => {
    run();

    expect(next).toHaveBeenCalledTimes(1);
  });
});
