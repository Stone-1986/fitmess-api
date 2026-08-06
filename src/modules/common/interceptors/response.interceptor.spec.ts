import { of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { ResponseInterceptor } from './response.interceptor.js';

/**
 * Descubierto en QA de EPICA-02 (DELETE /exercises/:id — HU-007): este
 * interceptor es el UNICO punto del proyecto que hasta ahora carecia de
 * cobertura (0% antes de este archivo). El endpoint de inhabilitacion es el
 * primero en usar el patron `{ data: null, message }` (design-patterns skill
 * seccion 5, ya prescrito para Plan.archive() de EPICA-03) — y expuso un bug
 * real: `data?.data ?? data` interpretaba un `data.data` explicitamente
 * `null` como "no viene envuelto" y caia al fallback, devolviendo el objeto
 * COMPLETO en vez de `null`. Corregido con una verificacion explicita de
 * presencia de la clave 'data' (`'data' in data`) en vez de `??`. El test
 * que documentaba el defecto ahora verifica el comportamiento correcto — ver
 * "desenvuelve { data: null, message }..." mas abajo.
 */
function buildContext(): ExecutionContext {
  return {
    switchToHttp: () => ({
      getResponse: () => ({ statusCode: 200 }),
    }),
  } as unknown as ExecutionContext;
}

function buildHandler(returnValue: unknown): CallHandler {
  return { handle: () => of(returnValue) } as CallHandler;
}

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor();

  it('envuelve data plano (sin data/meta anidados) directamente en el envelope', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(buildContext(), buildHandler({ id: '1' })),
    );

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.data).toEqual({ id: '1' });
    expect(result.meta).toBeUndefined();
    expect(result.message).toBeUndefined();
    expect(result.timestamp).toBeDefined();
  });

  it('desenvuelve { data, meta } (paginacion) en el nivel superior del envelope', async () => {
    const meta = {
      page: 1,
      limit: 20,
      totalItems: 0,
      totalPages: 0,
      hasNext: false,
      hasPrevious: false,
    };
    const result = await firstValueFrom(
      interceptor.intercept(
        buildContext(),
        buildHandler({ data: [{ id: '1' }], meta }),
      ),
    );

    expect(result.data).toEqual([{ id: '1' }]);
    expect(result.meta).toEqual(meta);
  });

  it('desenvuelve { data, message } con data no nulo', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(
        buildContext(),
        buildHandler({ data: { id: '1' }, message: 'Creado' }),
      ),
    );

    expect(result.data).toEqual({ id: '1' });
    expect(result.message).toBe('Creado');
  });

  // ── Regresion del bug — ver DELETE /exercises/:id (HU-007) en QA EPICA-02 ──

  it('desenvuelve { data: null, message } preservando data=null explicito (soft-delete)', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(
        buildContext(),
        buildHandler({
          data: null,
          message: 'Ejercicio inhabilitado exitosamente',
        }),
      ),
    );

    // Contrato de DELETE /exercises/:id (plan_de_implementacion.yaml:
    // "{ data: null, message: string } (200)"). `'data' in data` distingue
    // la clave presente-con-valor-null de la clave ausente, a diferencia de
    // `data?.data ?? data` (el bug original), que trataba ambos casos igual.
    expect(result.data).toBeNull();
    expect(result.message).toBe('Ejercicio inhabilitado exitosamente');
  });

  it('preserva null cuando el controller retorna null directamente (sin envelope)', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(buildContext(), buildHandler(null)),
    );

    expect(result.data).toBeNull();
    expect(result.message).toBeUndefined();
  });

  it('preserva undefined cuando el controller no retorna nada', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(buildContext(), buildHandler(undefined)),
    );

    expect(result.data).toBeUndefined();
    expect(result.message).toBeUndefined();
  });
});
