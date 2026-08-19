import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { ValidationExceptionFilter } from './validation-exception.filter.js';
import { TechnicalError } from '../exceptions/technical-error.enum.js';

/**
 * Este filter produce TODOS los 400 de la API: los de validación de DTOs y los
 * BadRequestException sueltos. Estaba en 0% de cobertura desde EPICA-01
 * (hallazgo abierto #2b) pese a ser una de las rutas más transitadas.
 */
function buildHost(url = '/api/auth/register', correlationId = 'corr-1') {
  const json = vi.fn();
  const header = vi.fn().mockReturnValue({ json });
  const status = vi.fn().mockReturnValue({ header });
  const request = { url, correlationId } as Record<string, unknown>;

  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return {
    host,
    request,
    status,
    header,
    json,
    payload: () => json.mock.calls[0][0] as Record<string, unknown>,
  };
}

describe('ValidationExceptionFilter', () => {
  let filter: ValidationExceptionFilter;

  beforeEach(() => {
    filter = new ValidationExceptionFilter();
  });

  describe('errores del ValidationPipe (isValidation: true)', () => {
    const errors = [
      {
        field: 'email',
        message: 'El correo electronico no tiene un formato valido',
      },
      {
        field: 'password',
        message: 'La contrasena debe tener al menos 8 caracteres',
      },
    ];

    it('responde 400 con Content-Type application/problem+json (RFC 9457)', () => {
      const ctx = buildHost();

      filter.catch(
        new BadRequestException({ isValidation: true, errors }),
        ctx.host,
      );

      expect(ctx.status).toHaveBeenCalledWith(
        TechnicalError.VALIDATION_ERROR.httpStatus,
      );
      expect(ctx.header).toHaveBeenCalledWith(
        'Content-Type',
        'application/problem+json',
      );
    });

    it('usa la entrada VALIDATION_ERROR del catálogo', () => {
      const ctx = buildHost();

      filter.catch(
        new BadRequestException({ isValidation: true, errors }),
        ctx.host,
      );

      const payload = ctx.payload();
      expect(payload.errorCode).toBe(TechnicalError.VALIDATION_ERROR.code);
      expect(payload.title).toBe(TechnicalError.VALIDATION_ERROR.title);
    });

    it('propaga el detalle por campo — es lo que el cliente necesita para corregir el formulario', () => {
      const ctx = buildHost();

      filter.catch(
        new BadRequestException({ isValidation: true, errors }),
        ctx.host,
      );

      expect(ctx.payload().errors).toEqual(errors);
    });

    it('propaga el correlationId y la ruta que fallo', () => {
      const ctx = buildHost('/api/exercises', 'corr-abc');

      filter.catch(
        new BadRequestException({ isValidation: true, errors }),
        ctx.host,
      );

      const payload = ctx.payload();
      expect(payload.correlationId).toBe('corr-abc');
      expect(payload.instance).toBe('/api/exercises');
    });

    it('deja el errorCode en el request para que el AuditMiddleware lo registre', () => {
      const ctx = buildHost();

      filter.catch(
        new BadRequestException({ isValidation: true, errors }),
        ctx.host,
      );

      expect(ctx.request.auditErrorCode).toBe(
        TechnicalError.VALIDATION_ERROR.code,
      );
    });
  });

  describe('BadRequestException genérico (fuera del ValidationPipe)', () => {
    it('usa la entrada BAD_REQUEST, no VALIDATION_ERROR', () => {
      const ctx = buildHost();

      filter.catch(new BadRequestException('Parametro invalido'), ctx.host);

      const payload = ctx.payload();
      expect(payload.errorCode).toBe(TechnicalError.BAD_REQUEST.code);
      expect(payload.errorCode).not.toBe(TechnicalError.VALIDATION_ERROR.code);
    });

    it('no incluye el arreglo errors — no hay detalle por campo que dar', () => {
      const ctx = buildHost();

      filter.catch(new BadRequestException('Parametro invalido'), ctx.host);

      expect(ctx.payload().errors).toBeUndefined();
    });

    it('usa el message de la excepción como detail', () => {
      const ctx = buildHost();

      filter.catch(new BadRequestException('Parametro invalido'), ctx.host);

      expect(ctx.payload().detail).toBe('Parametro invalido');
    });

    it('deja BAD_REQUEST en el request para la auditoría', () => {
      const ctx = buildHost();

      filter.catch(new BadRequestException('Parametro invalido'), ctx.host);

      expect(ctx.request.auditErrorCode).toBe(TechnicalError.BAD_REQUEST.code);
    });

    it('responde igualmente con Content-Type application/problem+json', () => {
      const ctx = buildHost();

      filter.catch(new BadRequestException('Parametro invalido'), ctx.host);

      expect(ctx.header).toHaveBeenCalledWith(
        'Content-Type',
        'application/problem+json',
      );
    });
  });

  it('un objeto sin el flag isValidation NO se trata como error de validación', () => {
    const ctx = buildHost();

    // Sin `isValidation: true` es un BadRequestException cualquiera: el flag lo
    // inyecta el exceptionFactory de main.ts y es lo único que distingue ambos
    // caminos.
    filter.catch(
      new BadRequestException({ message: 'algo salio mal' }),
      ctx.host,
    );

    expect(ctx.payload().errorCode).toBe(TechnicalError.BAD_REQUEST.code);
  });
});
